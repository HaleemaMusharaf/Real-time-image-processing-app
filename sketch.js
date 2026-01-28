/*
==================================
Commentary
==================================

This project successfully implements an interactive webcam image processing application using p5.js. The design was based on a structured five-row grid pipeline,
where each row highlights a different stage of processing.
Features:
 - Live feed and capture mode
 - RGB channel isolation and thresholding
 - HSV and YCbCr color space conversion
 - Face detection with privacy filters (grayscale, blur, pixelate, etc.)
 - Extension box with fun filters (stickers) and record/save options

Findings:
When I applied thresholding to each colour channel, I noticed that every channel highlighted different details. The red channel showed skin areas more clearly,
while the blue channel was the most affected by lighting and looked noisy. Using HSV colour space was helpful because hue and saturation separate colour from brightness.
YCbCr worked in a similar way, making it easier to see colour information while keeping brightness intact. Overall, these comparisons showed that using different colour
spaces can make tasks like skin detection simpler.

Problems Faced:
The biggest challenge came from applying filters only to detected faces. Initially, the pixelation filter only produced a thin line across the forehead. This was solved
by implementing a custom pixel-blockify function that processed the face region independently. Another difficulty was with the extension overlay: at first, it closed
whenever a I interacted with buttons or dropdown menus. This was corrected by replacing the “click outside to close” behaviour with a dedicated close button.
I also explored third-party APIs for filters, but encountered issues with API limits and authorization. In the end, I relied on local filters and sticker overlays,
which made the application fully functional offline.

Target Completion:
I was largely on target to complete the project. All core requirements face detection, grayscale and brightness adjustment, colour channel visualisation, thresholding,
HSV/YCbCr conversion were completed. The majority of issues arose in the extensions and were resolved in time. If I were to approach this again, I would test external APIs
earlier and perhaps use a more reliable machine learning library for face and landmark detection to improve sticker alignment.

Extension:
My chosen extension is the “Extension Box.” When clicked, it expands into an overlay where the user can apply creative filters such as sepia, inversion, edge detection,
and pixelation. A unique feature is the ability to overlay fun stickers (hat, glasses, cat ears, dog nose), which scale and align dynamically with the detected face.
The extension box also provides an integrated capture/record/save/delete workflow. The Save button adapts based on context (“Save Image” or “Save Video”) and is disabled
until media is available, preventing errors. The Delete button also adapts to state (“Delete Image” or “Delete Video”), ensuring clarity for the user. This extension is
unique because it combines technical image processing with an engaging, interactive interface that mimics playful social media filters, making it more appealing than a
purely technical demonstration.

Conclusion:
The project demonstrates both fundamental image processing principles and creative enhancements. Despite facing technical challenges, I was able to overcome them and
deliver a complete, working system. In future iterations, I would further refine sticker positioning and explore more advanced real-time filters, but overall I am
satisfied with the outcome.

==================================
*/

/*
Name: Haleema Musharaf
Module: CM2030 – Graphics Programming
Final Project: Real-Time Image Processing
Instructions: Open index.html in a browser.
*/

// Global Variables
let camFeed, frameBuffer;

let monoBrightImg, redChannelImg, greenChannelImg, blueChannelImg;
let threshRedImg, threshGreenImg, threshBlueImg;
let hsvVersionImg, ycbcrVersionImg, hsvThreshImg, ycbcrThreshImg;

let faceScanner;
let currentFaceBox = null;

let faceFilterMode = 0;
let isLive = true;

// UI elems (left panel)
let uiPanel, btnLive, btnCapture;
let sliderRed, sliderGreen, sliderBlue;

// Canvas size & grid
const cellW = 360,
    cellH = 280;
const CANVAS_W = cellW * 3;
const CANVAS_H = cellH * 5;

let extensionBox;

let stickers = {};
// Preload stickers for fun filters
function preload() {
    stickers["Cat Ears"] = loadImage("stickers/cat-ears.png");
    stickers["Dog Nose"] = loadImage("stickers/dog-nose.png");
    stickers.Hat = loadImage("stickers/hat.png");
    stickers.Glasses = loadImage("stickers/glasses.png");
    stickers.Sunglasses = loadImage("stickers/sunglasses.png");
}

// Setup canvas, webcam feed, face detector, and UI
function setup() {
    const cnv = createCanvas(CANVAS_W, CANVAS_H);

    camFeed = createCapture(VIDEO);
    camFeed.size(160, 120);
    camFeed.hide();

    faceScanner = new objectdetect.detector(160, 120, 1.1, objectdetect.frontalface);

    buildUiPanel();
    positionUiPanelLeftOfCanvas(cnv);

    frameBuffer = camFeed.get();
    frameBuffer.resize(160, 120);

    extensionBox = new ExtensionBox(stickers);
}
// Reposition UI when window resizes
function windowResized() {
    const cnv = select("canvas");
    if (cnv) {
        positionUiPanelLeftOfCanvas(cnv);
        if (extensionBox.expanded) extensionBox.positionControls();
    }
}
// Main render loop: updates frames, runs pipeline, draws grid of outputs
function draw() {
    background("#C5DBC4");

    if (isLive) {
        frameBuffer = camFeed.get();
        frameBuffer.resize(160, 120);
    }

    makeGrayscaleWithBoost();
    isolateChannels();
    applyChannelThresholds();
    toHSVSpace();
    toYCbCrSpace();
    applyModelThresholds();
    runFaceDetection();

    const pad = 20;

    // --- Row 1 ---
    drawLabeledCell("Face Detection", 0, 0, cellW, cellH);
    drawFaceWithFilter(0 + pad, 0 + 40, cellW - pad * 2, cellH - 60);

    drawLabeledCell("Grayscale + Brightness", cellW, 0, cellW, cellH);
    image(monoBrightImg, cellW + pad, 0 + 40, cellW - pad * 2, cellH - 60);

    drawLabeledCell("Extension Box", 2 * cellW, 0, cellW, cellH);
    image(frameBuffer, 2 * cellW + pad, 0 + 40, cellW - pad * 2, cellH - 60);

    // --- Row 2 ---
    drawLabeledCell("Red Channel", 0, cellH, cellW, cellH);
    image(redChannelImg, 0 + pad, cellH + 40, cellW - pad * 2, cellH - 60);

    drawLabeledCell("Green Channel", cellW, cellH, cellW, cellH);
    image(greenChannelImg, cellW + pad, cellH + 40, cellW - pad * 2, cellH - 60);

    drawLabeledCell("Blue Channel", 2 * cellW, cellH, cellW, cellH);
    image(blueChannelImg, 2 * cellW + pad, cellH + 40, cellW - pad * 2, cellH - 60);

    // --- Row 3 ---
    drawLabeledCell("Thresholded Red", 0, 2 * cellH, cellW, cellH);
    image(threshRedImg, 0 + pad, 2 * cellH + 40, cellW - pad * 2, cellH - 60);

    drawLabeledCell("Thresholded Green", cellW, 2 * cellH, cellW, cellH);
    image(threshGreenImg, cellW + pad, 2 * cellH + 40, cellW - pad * 2, cellH - 60);

    drawLabeledCell("Thresholded Blue", 2 * cellW, 2 * cellH, cellW, cellH);
    image(threshBlueImg, 2 * cellW + pad, 2 * cellH + 40, cellW - pad * 2, cellH - 60);

    // --- Row 4 ---
    drawLabeledCell("HSV Space", 0, 3 * cellH, cellW, cellH);
    image(hsvVersionImg, 0 + pad, 3 * cellH + 40, cellW - pad * 2, cellH - 60);

    drawLabeledCell("YCbCr Space", cellW, 3 * cellH, cellW, cellH);
    image(ycbcrVersionImg, cellW + pad, 3 * cellH + 40, cellW - pad * 2, cellH - 60);

    drawLabeledCell("Original Copy", 2 * cellW, 3 * cellH, cellW, cellH);
    image(frameBuffer, 2 * cellW + pad, 3 * cellH + 40, cellW - pad * 2, cellH - 60);

    // --- Row 5 ---
    drawLabeledCell("Thresholded HSV", 0, 4 * cellH, cellW, cellH);
    image(hsvThreshImg, 0 + pad, 4 * cellH + 40, cellW - pad * 2, cellH - 60);

    drawLabeledCell("Thresholded YCbCr", cellW, 4 * cellH, cellW, cellH);
    image(ycbcrThreshImg, cellW + pad, 4 * cellH + 40, cellW - pad * 2, cellH - 60);

    drawLabeledCell("Original Copy", 2 * cellW, 4 * cellH, cellW, cellH);
    image(frameBuffer, 2 * cellW + pad, 4 * cellH + 40, cellW - pad * 2, cellH - 60);

    // Face cell header overlay (top-left cell)
    drawFaceCellHeader();

    if (extensionBox.expanded) {
        extensionBox.draw();
    }
}
//UI Panel
// Build the left-side control panel (live/capture, sliders, help)
function buildUiPanel() {
    uiPanel = createDiv();
    uiPanel.addClass("ui-panel");

    // Live / Capture
    const rowBtns = createDiv().addClass("row panel-box").parent(uiPanel);
    btnLive = createButton("Live");
    btnCapture = createButton("Capture");
    btnLive.parent(rowBtns);
    btnCapture.parent(rowBtns);

    const setActive = (which) => {
        btnLive.removeClass("active");
        btnCapture.removeClass("active");
        if (which === "live") btnLive.addClass("active");
        if (which === "cap") btnCapture.addClass("active");
    };
    setActive("live");

    btnLive.mousePressed(() => {
        isLive = true;
        setActive("live");
    });

    btnCapture.mousePressed(() => {
        frameBuffer = camFeed.get();
        frameBuffer.resize(160, 120);
        isLive = false;
        setActive("cap");
    });

    // Sliders
    const sliderBox = createDiv().addClass("row panel-box").parent(uiPanel);
    createSpan("Red Threshold").addClass("label").parent(sliderBox);
    sliderRed = createSlider(0, 255, 100).style("width", "100%").parent(sliderBox);
    createSpan("Green Threshold").addClass("label").parent(sliderBox);
    sliderGreen = createSlider(0, 255, 150).style("width", "100%").parent(sliderBox);
    createSpan("Blue Threshold").addClass("label").parent(sliderBox);
    sliderBlue = createSlider(0, 255, 200).style("width", "100%").parent(sliderBox);

    // Help
    createDiv("<strong>Keys:</strong> 0=Off, 1=Gray, 2=Blur, 3=HSV overlay, 4=Pixelate")
        .addClass("row keys-help panel-box")
        .parent(uiPanel);
}
// Position UI panel relative to the canvas
function positionUiPanelLeftOfCanvas(cnv) {
    const rect = cnv.elt.getBoundingClientRect();
    const panelWidth = 220;
    const gap = 24;
    uiPanel.position(rect.left - panelWidth - gap + window.scrollX, rect.top + window.scrollY);
}
// ExtensionBox: manages optional filters, stickers, capture/record/save
class ExtensionBox {
    constructor(stickers) {
        this.stickers = stickers;
        this.expanded = false;
        this.filter = "None";
        this.recording = false;

        // video recording state
        this.mediaRecorder = null;
        this.recordedChunks = [];

        this.createControls();
        this.hideControls();
    }

    // Create extension panel controls (filters, capture, record, save/delete)
    createControls() {
        this.panel = createDiv().addClass("ui-panel").hide();

        const titleBox = createDiv("Extension Controls").addClass("row panel-box");
        titleBox.parent(this.panel);

        // LOCAL FILTERS
        const localBox = createDiv().addClass("row panel-box").parent(this.panel);
        createSpan("Local Filter").addClass("label").parent(localBox);
        this.dropdownLocal = createSelect().style("width", "100%").parent(localBox);
        this.dropdownLocal.option("Choose Local Filter");
        ["None", "Grayscale", "Blur", "HSV Overlay", "Pixelate", "Sepia", "Invert", "Edge"].forEach((opt) =>
            this.dropdownLocal.option(opt)
        );
        this.dropdownLocal.selected("Choose Local Filter");
        this.dropdownLocal.changed(() => {
            const v = this.dropdownLocal.value();
            this.filter = v === "Choose Local Filter" ? "None" : v;
        });

        // FUN FILTERS
        const apiBox = createDiv().addClass("row panel-box").parent(this.panel);
        createSpan("Fun Filter").addClass("label").parent(apiBox);
        this.dropdownApi = createSelect().style("width", "100%").parent(apiBox);
        this.dropdownApi.option("Choose Fun Filter");
        ["None", "Cat Ears", "Dog Nose", "Hat", "Glasses", "Sunglasses"].forEach((opt) => this.dropdownApi.option(opt));
        this.dropdownApi.selected("Choose Fun Filter");
        this.dropdownApi.changed(() => {
            const choice = this.dropdownApi.value();
            this.filter = choice === "Choose Fun Filter" ? "None" : choice;
        });

        // BUTTONS
        const btnBox1 = createDiv().addClass("row panel-box").parent(this.panel);
        const btnCaptureExt = createButton("Capture").parent(btnBox1);
        const btnRecordExt = createButton("Record").parent(btnBox1);

        const btnBox2 = createDiv().addClass("row panel-box").parent(this.panel);
        this.btnSaveExt = createButton("Save Image").parent(btnBox2);
        this.btnDeleteExt = createButton("Delete").parent(btnBox2);

        const closeRow = createDiv().addClass("row panel-box").parent(this.panel);
        const btnCloseExt = createButton("Close ×").parent(closeRow);

        // Initially disabled
        this.btnSaveExt.attribute("disabled", true);
        this.btnDeleteExt.attribute("disabled", true);

        // Handlers
        btnCaptureExt.mousePressed(() => {
            if (this.recording) return; // disabled while recording
            frameBuffer = camFeed.get();
            frameBuffer.resize(160, 120);
            isLive = false;
            this.lastCaptureType = "image";

            // Update buttons
            this.btnSaveExt.html("Save Image").removeAttribute("disabled");
            this.btnDeleteExt.html("Delete Image").removeAttribute("disabled");
        });

        btnRecordExt.mousePressed(() => {
            if (!this.recording) {
                // Start recording
                const stream = document.querySelector("canvas").captureStream(30);
                this.mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
                this.recordedChunks = [];

                this.mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) this.recordedChunks.push(e.data);
                };

                this.mediaRecorder.onstop = () => {
                    this.recordedBlob = new Blob(this.recordedChunks, { type: "video/webm" });
                    this.lastCaptureType = "video";

                    // Update buttons
                    this.btnSaveExt.html("Save Video").removeAttribute("disabled");
                    this.btnDeleteExt.html("Delete Video").removeAttribute("disabled");
                };

                this.mediaRecorder.start();
                this.recording = true;
                btnRecordExt.html("Stop");
                btnCaptureExt.attribute("disabled", true); // disable capture during recording
            } else {
                // Stop recording
                this.mediaRecorder.stop();
                this.recording = false;
                btnRecordExt.html("Record");
                btnCaptureExt.removeAttribute("disabled");
            }
        });

        this.btnSaveExt.mousePressed(() => {
            if (this.lastCaptureType === "video" && this.recordedBlob) {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(this.recordedBlob);
                a.download = "recording.webm";
                a.click();
            } else if (this.lastCaptureType === "image") {
                saveCanvas("extension_view", "png");
            }
        });

        this.btnDeleteExt.mousePressed(() => {
            isLive = true;
            this.recording = false;
            this.recordedBlob = null;
            this.recordedChunks = [];
            this.filter = "None";
            this.dropdownLocal.selected("Choose Local Filter");
            this.dropdownApi.selected("Choose Fun Filter");
            this.lastCaptureType = null;

            // Reset buttons
            this.btnSaveExt.html("Save Image").attribute("disabled", true);
            this.btnDeleteExt.html("Delete").attribute("disabled", true);
            btnCaptureExt.removeAttribute("disabled");
            btnRecordExt.html("Record");
        });

        btnCloseExt.mousePressed(() => {
            this.expanded = false;
            this.hideControls();
        });
    }
    // Show/hide/position extension controls
    showControls() {
        this.panel.show();
        this.positionControls();
    }
    hideControls() {
        this.panel.hide();
    }

    positionControls() {
        if (!this.panel || !uiPanel) return;
        const rect = uiPanel.elt.getBoundingClientRect();
        const gap = 12;
        this.panel.position(rect.left + window.scrollX, rect.bottom + window.scrollY + gap);
    }

    // Draw extension overlay with filter or sticker applied
    draw() {
        const pad = 20;
        push();
        fill(255, 255, 255, 230);
        noStroke();
        rect(pad, pad, CANVAS_W - 2 * pad, CANVAS_H - 2 * pad, 20);

        fill("#09190D");
        textAlign(LEFT, CENTER);
        textSize(18);
        text(`Extension • Filter: ${this.filter}`, pad + 20, pad + 20);
        pop();

        // Drawing area
        const imgPad = 40,
            topPad = 70;
        const drawW = CANVAS_W - 2 * imgPad;
        const drawH = CANVAS_H - imgPad - topPad;

        let toDraw = this.applyFilter(frameBuffer);
        image(toDraw, imgPad, topPad, drawW, drawH);

        // Stickers
        if (this.stickers[this.filter] && currentFaceBox) {
            const [fx, fy, fw, fh] = currentFaceBox;
            const faceX = imgPad + (fx / frameBuffer.width) * drawW;
            const faceY = topPad + (fy / frameBuffer.height) * drawH;
            const faceW = (fw / frameBuffer.width) * drawW;
            const faceH = (fh / frameBuffer.height) * drawH;

            let w, h, x, y;
            if (this.filter === "Hat") {
                w = faceW * 1.6;
                h = faceH * 0.9;
                x = faceX - (w - faceW) / 2;
                y = faceY - h * 0.95;
            } else if (this.filter === "Cat Ears") {
                w = faceW * 1.5;
                h = faceH * 0.7;
                x = faceX - (w - faceW) / 2;
                y = faceY - h * 0.6;
            } else if (this.filter === "Dog Nose") {
                w = faceW * 0.85;
                h = faceH * 0.45;
                x = faceX + faceW * 0.135;
                y = faceY + faceH * 0.35;
            } else if (this.filter === "Glasses" || this.filter === "Sunglasses") {
                w = faceW * 1.05;
                h = faceH * 0.38;
                x = faceX - (w - faceW) / 2;
                y = faceY + faceH * 0.18;
            }
            image(this.stickers[this.filter], x, y, w, h);
        }

        // Recording dot
        if (this.recording && frameCount % 60 < 30) {
            push();
            fill(255, 0, 0);
            noStroke();
            circle(CANVAS_W - 40, pad + 24, 12);
            pop();
        }

        // Keep controls aligned
        this.positionControls();
    }

    // Apply selected filter to the current frame
    applyFilter(img) {
        if (this.filter === "None" || !img) return img;
        let out = img.get();

        if (this.filter === "Grayscale") out.filter(GRAY);
        else if (this.filter === "Blur") out.filter(BLUR, 3);
        else if (this.filter === "HSV Overlay") out = hsvVersionImg.get();
        else if (this.filter === "Pixelate") out = pixelBlockify(out, 10);
        else if (this.filter === "Sepia") {
            out.loadPixels();
            for (let i = 0; i < out.pixels.length; i += 4) {
                const r = out.pixels[i],
                    g = out.pixels[i + 1],
                    b = out.pixels[i + 2];
                out.pixels[i] = min(255, r * 0.393 + g * 0.769 + b * 0.189);
                out.pixels[i + 1] = min(255, r * 0.349 + g * 0.686 + b * 0.168);
                out.pixels[i + 2] = min(255, r * 0.272 + g * 0.534 + b * 0.131);
            }
            out.updatePixels();
        } else if (this.filter === "Invert") out.filter(INVERT);
        else if (this.filter === "Edge") {
            out.filter(GRAY);
            out.filter(THRESHOLD, 0.5);
        }

        return out;
    }
    // Handle mouse click on extension box cell
    handleClick(mx, my) {
        if (!this.expanded) {
            if (mx > 2 * cellW && mx < 3 * cellW && my > 0 && my < cellH) {
                this.expanded = true;
                this.showControls();
            }
        }
    }
}

// Pipeline functions
// Convert frame to grayscale with brightness boost
function makeGrayscaleWithBoost() {
    monoBrightImg = createImage(frameBuffer.width, frameBuffer.height);
    monoBrightImg.loadPixels();
    frameBuffer.loadPixels();
    for (let p = 0; p < frameBuffer.pixels.length; p += 4) {
        const r = frameBuffer.pixels[p];
        const g = frameBuffer.pixels[p + 1];
        const b = frameBuffer.pixels[p + 2];
        let grayVal = 0.299 * r + 0.587 * g + 0.114 * b;
        grayVal = min(grayVal * 1.2, 255);
        monoBrightImg.pixels[p] = monoBrightImg.pixels[p + 1] = monoBrightImg.pixels[p + 2] = grayVal;
        monoBrightImg.pixels[p + 3] = 255;
    }
    monoBrightImg.updatePixels();
}
// Separate R, G, B channels into individual images
function isolateChannels() {
    redChannelImg = createImage(frameBuffer.width, frameBuffer.height);
    greenChannelImg = createImage(frameBuffer.width, frameBuffer.height);
    blueChannelImg = createImage(frameBuffer.width, frameBuffer.height);

    redChannelImg.loadPixels();
    greenChannelImg.loadPixels();
    blueChannelImg.loadPixels();
    frameBuffer.loadPixels();

    for (let i = 0; i < frameBuffer.pixels.length; i += 4) {
        redChannelImg.pixels[i] = frameBuffer.pixels[i];
        redChannelImg.pixels[i + 1] = 0;
        redChannelImg.pixels[i + 2] = 0;
        redChannelImg.pixels[i + 3] = 255;

        greenChannelImg.pixels[i] = 0;
        greenChannelImg.pixels[i + 1] = frameBuffer.pixels[i + 1];
        greenChannelImg.pixels[i + 2] = 0;
        greenChannelImg.pixels[i + 3] = 255;

        blueChannelImg.pixels[i] = 0;
        blueChannelImg.pixels[i + 1] = 0;
        blueChannelImg.pixels[i + 2] = frameBuffer.pixels[i + 2];
        blueChannelImg.pixels[i + 3] = 255;
    }
    redChannelImg.updatePixels();
    greenChannelImg.updatePixels();
    blueChannelImg.updatePixels();
}
// Apply user-controlled thresholds to each channel
function applyChannelThresholds() {
    threshRedImg = runThreshold(frameBuffer, sliderRed.value(), "R");
    threshGreenImg = runThreshold(frameBuffer, sliderGreen.value(), "G");
    threshBlueImg = runThreshold(frameBuffer, sliderBlue.value(), "B");
}
// Run thresholding on an image
function runThreshold(imgSrc, cutoff, target = "ALL") {
    const outImg = createImage(imgSrc.width, imgSrc.height);
    outImg.loadPixels();
    imgSrc.loadPixels();
    for (let idx = 0; idx < imgSrc.pixels.length; idx += 4) {
        const r = imgSrc.pixels[idx];
        const g = imgSrc.pixels[idx + 1];
        const b = imgSrc.pixels[idx + 2];
        let intensity = (r + g + b) / 3;
        if (target === "R") intensity = r;
        else if (target === "G") intensity = g;
        else if (target === "B") intensity = b;

        const bin = intensity > cutoff ? 255 : 0;
        outImg.pixels[idx] = outImg.pixels[idx + 1] = outImg.pixels[idx + 2] = bin;
        outImg.pixels[idx + 3] = 255;
    }
    outImg.updatePixels();
    return outImg;
}
// Convert frame to HSV color space
function toHSVSpace() {
    hsvVersionImg = createImage(frameBuffer.width, frameBuffer.height);
    hsvVersionImg.loadPixels();
    frameBuffer.loadPixels();
    for (let i = 0; i < frameBuffer.pixels.length; i += 4) {
        let r = frameBuffer.pixels[i] / 255;
        let g = frameBuffer.pixels[i + 1] / 255;
        let b = frameBuffer.pixels[i + 2] / 255;
        let maxVal = Math.max(r, g, b),
            minVal = Math.min(r, g, b);
        let h,
            s,
            v = maxVal;
        let delta = maxVal - minVal;
        s = maxVal === 0 ? 0 : delta / maxVal;
        if (maxVal === minVal) h = 0;
        else if (maxVal === r) h = (g - b) / delta + (g < b ? 6 : 0);
        else if (maxVal === g) h = (b - r) / delta + 2;
        else h = (r - g) / delta + 4;
        h /= 6;
        hsvVersionImg.pixels[i] = h * 255;
        hsvVersionImg.pixels[i + 1] = s * 255;
        hsvVersionImg.pixels[i + 2] = v * 255;
        hsvVersionImg.pixels[i + 3] = 255;
    }
    hsvVersionImg.updatePixels();
}
// Convert frame to YCbCr color space
function toYCbCrSpace() {
    ycbcrVersionImg = createImage(frameBuffer.width, frameBuffer.height);
    ycbcrVersionImg.loadPixels();
    frameBuffer.loadPixels();
    for (let i = 0; i < frameBuffer.pixels.length; i += 4) {
        let r = frameBuffer.pixels[i];
        let g = frameBuffer.pixels[i + 1];
        let b = frameBuffer.pixels[i + 2];
        let y = 0.299 * r + 0.587 * g + 0.114 * b;
        let cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        let cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        ycbcrVersionImg.pixels[i] = y;
        ycbcrVersionImg.pixels[i + 1] = cb;
        ycbcrVersionImg.pixels[i + 2] = cr;
        ycbcrVersionImg.pixels[i + 3] = 255;
    }
    ycbcrVersionImg.updatePixels();
}
// Apply thresholding to HSV and YCbCr images
function applyModelThresholds() {
    hsvThreshImg = runThreshold(hsvVersionImg, 128);
    ycbcrThreshImg = runThreshold(ycbcrVersionImg, 128);
}

// Face detection & face cell
// Detect face in current frame
function runFaceDetection() {
    const source = isLive ? camFeed.elt : frameBuffer.canvas;
    try {
        const boxes = faceScanner.detect(source);
        currentFaceBox = boxes && boxes.length ? boxes[0] : null;
    } catch (e) {
        currentFaceBox = null;
    }
}
// Draw detected face with selected privacy filter
function drawFaceWithFilter(x, y, w, h) {
    const preview = frameBuffer.get();

    if (currentFaceBox) {
        let scaleX = frameBuffer.width / 160;
        let scaleY = frameBuffer.height / 120;

        let fx = Math.floor(currentFaceBox[0] * scaleX);
        let fy = Math.floor(currentFaceBox[1] * scaleY);
        let fw = Math.floor(currentFaceBox[2] * scaleX);
        let fh = Math.floor(currentFaceBox[3] * scaleY);

        let faceOutput;

        if (faceFilterMode === 1) {
            faceOutput = convertToGray(frameBuffer.get(fx, fy, fw, fh));
        } else if (faceFilterMode === 2) {
            faceOutput = frameBuffer.get(fx, fy, fw, fh);
            faceOutput.filter(BLUR, 3);
        } else if (faceFilterMode === 3) {
            faceOutput = hsvVersionImg.get(fx, fy, fw, fh);
        } else if (faceFilterMode === 4) {
            let faceCrop = frameBuffer.get(fx, fy, fw, fh);
            faceOutput = pixelBlockify(faceCrop, 10);
        } else {
            faceOutput = frameBuffer.get(fx, fy, fw, fh);
        }

        // Paste processed face back
        preview.copy(faceOutput, 0, 0, faceOutput.width, faceOutput.height, fx, fy, fw, fh);

        // Draw preview with processed face
        image(preview, x, y, w, h);

        // Draw red rectangle "on top" of the face box
        push();
        noFill();
        stroke(255, 0, 0);
        strokeWeight(3);
        rect(
            x + (fx / frameBuffer.width) * w,
            y + (fy / frameBuffer.height) * h,
            (fw / frameBuffer.width) * w,
            (fh / frameBuffer.height) * h
        );
        pop();
    } else {
        // No face detected, just draw the frameBuffer
        image(preview, x, y, w, h);
    }
}
// Draw overlay labels in face cell (status, live/paused, no-face warning)
function drawFaceCellHeader() {
    push();
    noStroke();
    fill(0, 0, 0, 150);
    rect(0, 0, 190, 24);
    fill(255);
    textAlign(LEFT, CENTER);
    textSize(12);
    text(`FACE • ${isLive ? "LIVE" : "PAUSED"}`, 8, 12);

    if (!currentFaceBox) {
        fill(0, 0, 0, 150);
        rect(0, cellH - 22, 168, 22);
        fill(255);
        text("No face detected", 8, cellH - 11);
    }
    pop();
}

// Draw a labeled cell in the grid
function drawLabeledCell(label, x, y, w, h) {
    push();
    fill(255, 255, 255, 220);
    noStroke();
    rect(x + 10, y + 30, w - 20, h - 40, 20);

    textAlign(CENTER, BOTTOM);
    textSize(16);
    fill("#09190D");
    text(label, x + w / 2, y + 22);
    pop();
}

// Helper image functions
// Convert an image region to grayscale
function convertToGray(img) {
    const outImg = createImage(img.width, img.height);
    outImg.loadPixels();
    img.loadPixels();
    for (let i = 0; i < img.pixels.length; i += 4) {
        const r = img.pixels[i];
        const g = img.pixels[i + 1];
        const b = img.pixels[i + 2];
        const gray = (r + g + b) / 3;
        outImg.pixels[i] = outImg.pixels[i + 1] = outImg.pixels[i + 2] = gray;
        outImg.pixels[i + 3] = 255;
    }
    outImg.updatePixels();
    return outImg;
}
// Pixelate an image region using block averaging
function pixelBlockify(img, blockSize = 12) {
    const outImg = createImage(img.width, img.height);

    img.loadPixels();
    outImg.loadPixels();

    for (let y = 0; y < img.height; y += blockSize) {
        for (let x = 0; x < img.width; x += blockSize) {
            const cx = Math.min(x + Math.floor(blockSize / 2), img.width - 1);
            const cy = Math.min(y + Math.floor(blockSize / 2), img.height - 1);
            const idx = 4 * (cy * img.width + cx);

            const r = img.pixels[idx];
            const g = img.pixels[idx + 1];
            const b = img.pixels[idx + 2];

            // fill block
            for (let dy = 0; dy < blockSize; dy++) {
                for (let dx = 0; dx < blockSize; dx++) {
                    const xx = x + dx;
                    const yy = y + dy;
                    if (xx < img.width && yy < img.height) {
                        const didx = 4 * (yy * img.width + xx);
                        outImg.pixels[didx] = r;
                        outImg.pixels[didx + 1] = g;
                        outImg.pixels[didx + 2] = b;
                        outImg.pixels[didx + 3] = 255;
                    }
                }
            }
        }
    }

    outImg.updatePixels();
    return outImg;
}

// Mouse click: toggle extension overlay when clicking its cell
function mousePressed() {
    extensionBox.handleClick(mouseX, mouseY);
}

// Keyboard controls
// Keyboard shortcuts: change face filter or extension filter
function keyPressed() {
    // Face cell filters
    if (key === "0") faceFilterMode = 0;
    if (key === "1") faceFilterMode = 1;
    if (key === "2") faceFilterMode = 2;
    if (key === "3") faceFilterMode = 3;
    if (key === "4") faceFilterMode = 4;

    // Controls the Extension overlay when it's open
    if (extensionBox.expanded) {
        if (key === "0") extensionBox.filter = "None";
        if (key === "1") extensionBox.filter = "Grayscale";
        if (key === "2") extensionBox.filter = "Blur";
        if (key === "3") extensionBox.filter = "HSV Overlay";
        if (key === "4") extensionBox.filter = "Pixelate";
    }
}