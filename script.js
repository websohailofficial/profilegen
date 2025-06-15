let selectedFiles = [];
let processedImages = [];
let faceDetectionEnabled = false;
let currentEditIndex = null;
let tempBlob = null;
let positionX = 0;
let positionY = 0;

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const processBtn = document.getElementById('processBtn');
const clearBtn = document.getElementById('clearBtn');
const gallery = document.getElementById('gallery');
const status = document.getElementById('status');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const downloadArea = document.getElementById('downloadArea');
const naming = document.getElementById('naming');
const prefixGroup = document.getElementById('prefixGroup');
const zoomSlider = document.getElementById('zoom');
const zoomValue = document.getElementById('zoomValue');
const ratioSelect = document.getElementById('ratio');
const customRatioGroup = document.getElementById('customRatioGroup');
const customWidthRatio = document.getElementById('customWidthRatio');
const customHeightRatio = document.getElementById('customHeightRatio');

// Modal elements
const editModal = document.getElementById('editModal');
const modalClose = document.getElementById('modalClose');
const modalPreview = document.getElementById('modalPreview');
const modalZoom = document.getElementById('modalZoom');
const modalZoomValue = document.getElementById('modalZoomValue');
const modalPosition = document.getElementById('modalPosition');
const modalPositionX = document.getElementById('modalPositionX');
const modalPositionXValue = document.getElementById('modalPositionXValue');
const modalPositionY = document.getElementById('modalPositionY');
const modalPositionYValue = document.getElementById('modalPositionYValue');
const saveEditBtn = document.getElementById('saveEditBtn');

// Load face-api.js models with GitHub raw URLs
Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/weights'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/weights')
]).then(() => {
    faceDetectionEnabled = true;
    console.log('Face detection models loaded successfully');
    status.textContent = 'Face detection ready. Upload images to create profile pictures.';
}).catch(err => {
    faceDetectionEnabled = false;
    console.error('Error loading face detection models:', err);
    status.textContent = 'Face detection unavailable. Using center cropping instead.';
});

// Show/hide custom ratio inputs
ratioSelect.addEventListener('change', () => {
    if (ratioSelect.value === 'custom') {
        customRatioGroup.style.display = 'flex';
    } else {
        customRatioGroup.style.display = 'none';
    }
});

// Update zoom value display in real-time and sync slider with input
zoomSlider.addEventListener('input', () => {
    const value = parseFloat(zoomSlider.value).toFixed(1);
    zoomValue.value = value;
});

zoomValue.addEventListener('input', () => {
    let value = parseFloat(zoomValue.value);
    if (isNaN(value)) value = 1;
    value = Math.max(1, Math.min(3, value)); // Clamp between 1 and 3
    zoomSlider.value = value;
    zoomValue.value = value.toFixed(1);
});

modalZoom.addEventListener('input', () => {
    const value = parseFloat(modalZoom.value).toFixed(1);
    modalZoomValue.value = value;
    updatePreview();
});

modalZoomValue.addEventListener('input', () => {
    let value = parseFloat(modalZoomValue.value);
    if (isNaN(value)) value = 1;
    value = Math.max(1, Math.min(3, value)); // Clamp between 1 and 3
    modalZoom.value = value;
    modalZoomValue.value = value.toFixed(1);
    updatePreview();
});

modalPositionX.addEventListener('input', () => {
    positionX = parseFloat(modalPositionX.value);
    modalPositionXValue.value = positionX;
    updatePreview();
});

modalPositionXValue.addEventListener('input', () => {
    let value = parseFloat(modalPositionXValue.value);
    if (isNaN(value)) value = 0;
    value = Math.max(-100, Math.min(100, value)); // Clamp between -100 and 100
    positionX = value;
    modalPositionX.value = value;
    modalPositionXValue.value = value;
    updatePreview();
});

modalPositionY.addEventListener('input', () => {
    positionY = parseFloat(modalPositionY.value);
    modalPositionYValue.value = positionY;
    updatePreview();
});

modalPositionYValue.addEventListener('input', () => {
    let value = parseFloat(modalPositionYValue.value);
    if (isNaN(value)) value = 0;
    value = Math.max(-100, Math.min(100, value)); // Clamp between -100 and 100
    positionY = value;
    modalPositionY.value = value;
    modalPositionYValue.value = value;
    updatePreview();
});

// Show/hide prefix input based on naming choice
naming.addEventListener('change', () => {
    if (naming.value === 'custom') {
        prefixGroup.style.display = 'flex';
    } else {
        prefixGroup.style.display = 'none';
    }
});

// Upload area interactions
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});
uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});
uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
});

fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
});

function handleFiles(files) {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    selectedFiles = [...selectedFiles, ...imageFiles];
    updateUI();
}

function updateUI() {
    if (selectedFiles.length > 0) {
        processBtn.disabled = false;
        clearBtn.disabled = false;
        status.textContent = `${selectedFiles.length} image(s) selected`;
    } else {
        processBtn.disabled = true;
        clearBtn.disabled = true;
        status.textContent = faceDetectionEnabled ? 'Upload images to create profile pictures.' : 'Face detection unavailable. Upload images for center cropping.';
    }
}

processBtn.addEventListener('click', processImages);

clearBtn.addEventListener('click', () => {
    selectedFiles = [];
    processedImages = [];
    gallery.innerHTML = '';
    downloadArea.style.display = 'none';
    fileInput.value = '';
    updateUI();
});

async function processImages() {
    if (selectedFiles.length === 0) return;

    processBtn.disabled = true;
    clearBtn.disabled = true;
    progressBar.style.display = 'block';
    gallery.innerHTML = '';
    processedImages = [];

    const quality = parseFloat(document.getElementById('quality').value);
    const maxSize = parseInt(document.getElementById('maxSize').value) * 1024;
    const namingOption = document.getElementById('naming').value;
    const prefix = document.getElementById('prefix').value || 'profile';
    const format = document.getElementById('format').value;
    let ratio = document.getElementById('ratio').value;
    const zoom = parseFloat(document.getElementById('zoom').value);

    if (ratio === 'custom') {
        const widthRatio = parseInt(customWidthRatio.value) || 1;
        const heightRatio = parseInt(customHeightRatio.value) || 1;
        ratio = `${widthRatio}:${heightRatio}`;
    }

    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const progress = ((i + 1) / selectedFiles.length) * 100;
        progressFill.style.width = `${progress}%`;
        status.textContent = `Processing image ${i + 1} of ${selectedFiles.length}...`;

        try {
            const croppedBlob = await compressImage(file, quality, format, ratio, zoom, 'center', 0, 0, maxSize);
            let newFileName;
            
            if (namingOption === 'original') {
                const originalName = file.name;
                const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.'));
                const newExt = format === 'jpeg' ? 'jpg' : format;
                newFileName = `${nameWithoutExt}.${newExt}`;
            } else {
                newFileName = `${prefix}_${String(i + 1).padStart(3, '0')}.${format === 'jpeg' ? 'jpg' : format}`;
            }
            
            processedImages.push({
                blob: croppedBlob,
                fileName: newFileName,
                originalName: file.name,
                file: file,
                quality: quality,
                format: format,
                ratio: ratio,
                zoom: zoom,
                position: 'center',
                positionX: 0,
                positionY: 0,
                maxSize: maxSize
            });

            displayProcessedImage(croppedBlob, newFileName, file.name, i);
        } catch (error) {
            console.error('Error processing image:', error);
            status.textContent = `Error processing ${file.name}`;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
    }

    progressBar.style.display = 'none';
    status.textContent = `✅ Successfully processed ${processedImages.length} image(s)`;
    downloadArea.style.display = 'block';
    processBtn.disabled = false;
    clearBtn.disabled = false;
}

async function compressImage(file, quality, format, ratio, zoomLevel, position, positionXOffset, positionYOffset, maxSize) {
    return new Promise(async (resolve, reject) => {
        let currentQuality = quality;
        let currentBlob = await cropImage(file, currentQuality, format, ratio, zoomLevel, position, positionXOffset, positionYOffset);

        while (currentBlob.size > maxSize && currentQuality > 0.1) {
            currentQuality -= 0.1;
            currentBlob = await cropImage(file, currentQuality, format, ratio, zoomLevel, position, positionXOffset, positionYOffset);
        }

        if (currentBlob.size > maxSize) {
            const img = new Image();
            img.src = URL.createObjectURL(currentBlob);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                let scale = Math.sqrt(maxSize / currentBlob.size);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to compress image'));
                    }
                }, `image/${format}`, currentQuality);
            };
            img.onerror = () => reject(new Error('Failed to load image for compression'));
        } else {
            resolve(currentBlob);
        }
    });
}

async function cropImage(file, quality, format, ratio, zoomLevel, position, positionXOffset, positionYOffset) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const [widthRatio, heightRatio] = ratio.split(':').map(Number);
        const targetRatio = widthRatio / heightRatio;
        const paddingFactor = 0.1;

        img.onload = async () => {
            let cropWidth, cropHeight, cropX, cropY;
            let autoZoom = zoomLevel;

            const sourceRatio = img.width / img.height;
            let baseCropWidth, baseCropHeight;

            if (sourceRatio > targetRatio) {
                baseCropHeight = img.height;
                baseCropWidth = img.height * targetRatio;
            } else {
                baseCropWidth = img.width;
                baseCropHeight = img.width / targetRatio;
            }

            const minDimension = Math.min(baseCropWidth, baseCropHeight);
            autoZoom = Math.max(1, Math.min(3, (sourceRatio > targetRatio ? img.width / baseCropWidth : img.height / baseCropHeight) * zoomLevel));

            cropWidth = baseCropWidth * (1 + 2 * paddingFactor) / autoZoom;
            cropHeight = baseCropHeight * (1 + 2 * paddingFactor) / autoZoom;

            if (faceDetectionEnabled) {
                try {
                    const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
                    if (detections.length > 0) {
                        const face = detections[0].detection.box;
                        const faceCenterX = face.x + face.width / 2;
                        const faceCenterY = face.y + face.height / 2;

                        if (position === 'center') {
                            cropX = faceCenterX - cropWidth / 2;
                            cropY = faceCenterY - cropHeight / 2;
                        } else if (position === 'top-center') {
                            cropX = faceCenterX - cropWidth / 2;
                            cropY = faceCenterY - cropHeight * 0.8;
                        } else if (position === 'bottom-center') {
                            cropX = faceCenterX - cropWidth / 2;
                            cropY = faceCenterY - cropHeight * 0.2;
                        } else if (position === 'left-center') {
                            cropX = faceCenterX - cropWidth * 0.8;
                            cropY = faceCenterY - cropHeight / 2;
                        } else if (position === 'right-center') {
                            cropX = faceCenterX - cropWidth * 0.2;
                            cropY = faceCenterY - cropHeight / 2;
                        } else if (position === 'top-left') {
                            cropX = faceCenterX - cropWidth * 0.8;
                            cropY = faceCenterY - cropHeight * 0.8;
                        } else if (position === 'top-right') {
                            cropX = faceCenterX - cropWidth * 0.2;
                            cropY = faceCenterY - cropHeight * 0.8;
                        } else if (position === 'bottom-left') {
                            cropX = faceCenterX - cropWidth * 0.8;
                            cropY = faceCenterY - cropHeight * 0.2;
                        } else if (position === 'bottom-right') {
                            cropX = faceCenterX - cropWidth * 0.2;
                            cropY = faceCenterY - cropHeight * 0.2;
                        }

                        const scaleX = img.width / 200;
                        const scaleY = img.height / 200;
                        cropX += positionXOffset * scaleX;
                        cropY += positionYOffset * scaleY;

                        cropX = Math.max(0, Math.min(cropX, img.width - cropWidth));
                        cropY = Math.max(0, Math.min(cropY, img.height - cropHeight));
                    } else {
                        if (position === 'center') {
                            cropX = (img.width - cropWidth) / 2;
                            cropY = (img.height - cropHeight) / 2;
                        } else if (position === 'top-center') {
                            cropX = (img.width - cropWidth) / 2;
                            cropY = 0;
                        } else if (position === 'bottom-center') {
                            cropX = (img.width - cropWidth) / 2;
                            cropY = img.height - cropHeight;
                        } else if (position === 'left-center') {
                            cropX = 0;
                            cropY = (img.height - cropHeight) / 2;
                        } else if (position === 'right-center') {
                            cropX = img.width - cropWidth;
                            cropY = (img.height - cropHeight) / 2;
                        } else if (position === 'top-left') {
                            cropX = 0;
                            cropY = 0;
                        } else if (position === 'top-right') {
                            cropX = img.width - cropWidth;
                            cropY = 0;
                        } else if (position === 'bottom-left') {
                            cropX = 0;
                            cropY = img.height - cropHeight;
                        } else if (position === 'bottom-right') {
                            cropX = img.width - cropWidth;
                            cropY = img.height - cropHeight;
                        }

                        const scaleX = img.width / 200;
                        const scaleY = img.height / 200;
                        cropX += positionXOffset * scaleX;
                        cropY += positionYOffset * scaleY;

                        cropX = Math.max(0, Math.min(cropX, img.width - cropWidth));
                        cropY = Math.max(0, Math.min(cropY, img.height - cropHeight));
                    }
                } catch (err) {
                    console.error('Face detection failed for image:', err);
                    if (position === 'center') {
                        cropX = (img.width - cropWidth) / 2;
                        cropY = (img.height - cropHeight) / 2;
                    } else if (position === 'top-center') {
                        cropX = (img.width - cropWidth) / 2;
                        cropY = 0;
                    } else if (position === 'bottom-center') {
                        cropX = (img.width - cropWidth) / 2;
                        cropY = img.height - cropHeight;
                    } else if (position === 'left-center') {
                        cropX = 0;
                        cropY = (img.height - cropHeight) / 2;
                    } else if (position === 'right-center') {
                        cropX = img.width - cropWidth;
                        cropY = (img.height - cropHeight) / 2;
                    } else if (position === 'top-left') {
                        cropX = 0;
                        cropY = 0;
                    } else if (position === 'top-right') {
                        cropX = img.width - cropWidth;
                        cropY = 0;
                    } else if (position === 'bottom-left') {
                        cropX = 0;
                        cropY = img.height - cropHeight;
                    } else if (position === 'bottom-right') {
                        cropX = img.width - cropWidth;
                        cropY = img.height - cropHeight;
                    }

                    const scaleX = img.width / 200;
                    const scaleY = img.height / 200;
                    cropX += positionXOffset * scaleX;
                    cropY += positionYOffset * scaleY;

                    cropX = Math.max(0, Math.min(cropX, img.width - cropWidth));
                    cropY = Math.max(0, Math.min(cropY, img.height - cropHeight));
                }
            } else {
                if (position === 'center') {
                    cropX = (img.width - cropWidth) / 2;
                    cropY = (img.height - cropHeight) / 2;
                } else if (position === 'top-center') {
                    cropX = (img.width - cropWidth) / 2;
                    cropY = 0;
                } else if (position === 'bottom-center') {
                    cropX = (img.width - cropWidth) / 2;
                    cropY = img.height - cropHeight;
                } else if (position === 'left-center') {
                    cropX = 0;
                    cropY = (img.height - cropHeight) / 2;
                } else if (position === 'right-center') {
                    cropX = img.width - cropWidth;
                    cropY = (img.height - cropHeight) / 2;
                } else if (position === 'top-left') {
                    cropX = 0;
                    cropY = 0;
                } else if (position === 'top-right') {
                    cropX = img.width - cropWidth;
                    cropY = 0;
                } else if (position === 'bottom-left') {
                    cropX = 0;
                    cropY = img.height - cropHeight;
                } else if (position === 'bottom-right') {
                    cropX = img.width - cropWidth;
                    cropY = img.height - cropHeight;
                }

                const scaleX = img.width / 200;
                const scaleY = img.height / 200;
                cropX += positionXOffset * scaleX;
                cropY += positionYOffset * scaleY;

                cropX = Math.max(0, Math.min(cropX, img.width - cropWidth));
                cropY = Math.max(0, Math.min(cropY, img.height - cropHeight));
            }

            const outputWidth = 800;
            const outputHeight = outputWidth * (heightRatio / widthRatio);

            canvas.width = outputWidth;
            canvas.height = outputHeight;

            ctx.drawImage(
                img,
                cropX, cropY, cropWidth, cropHeight,
                0, 0, outputWidth, outputHeight
            );

            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to create blob'));
                }
            }, `image/${format}`, quality);
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
    });
}

function displayProcessedImage(blob, fileName, originalName, index) {
    const imageCard = document.createElement('div');
    imageCard.className = 'image-card';

    const img = document.createElement('img');
    img.className = 'image-preview';
    img.src = URL.createObjectURL(blob);
    img.style.aspectRatio = processedImages[index].ratio.replace(':', '/');

    const info = document.createElement('div');
    info.className = 'image-info';
    info.innerHTML = `
        <div class="image-name">${fileName}</div>
        <div>Original: ${originalName}</div>
        <div>Size: ${(blob.size / 1024).toFixed(1)} KB</div>
        <div>Zoom: ${processedImages[index].zoom.toFixed(1)}x</div>
        <div>Position: ${processedImages[index].position.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
    `;

    const editBtn = document.createElement('button');
    editBtn.className = 'btn edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openEditModal(index));

    imageCard.appendChild(img);
    imageCard.appendChild(info);
    imageCard.appendChild(editBtn);
    gallery.appendChild(imageCard);

    img.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
    });
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function openEditModal(index) {
    currentEditIndex = index;
    const imageData = processedImages[index];
    modalPreview.src = URL.createObjectURL(imageData.blob);
    modalZoom.value = imageData.zoom;
    modalZoomValue.value = imageData.zoom.toFixed(1);
    modalPosition.value = imageData.position;
    positionX = imageData.positionX;
    positionY = imageData.positionY;
    modalPositionX.value = positionX;
    modalPositionXValue.value = positionX;
    modalPositionY.value = positionY;
    modalPositionYValue.value = positionY;
    tempBlob = imageData.blob;
    editModal.style.display = 'flex';
}

const updatePreview = debounce(async () => {
    if (currentEditIndex === null) return;

    const imageData = processedImages[currentEditIndex];
    const newZoom = parseFloat(modalZoom.value);
    const newPosition = modalPosition.value;

    try {
        const newBlob = await compressImage(
            imageData.file,
            imageData.quality,
            imageData.format,
            imageData.ratio,
            newZoom,
            newPosition,
            positionX,
            positionY,
            imageData.maxSize
        );
        modalPreview.src = URL.createObjectURL(newBlob);
        tempBlob = newBlob;
    } catch (error) {
        console.error('Error updating preview:', error);
    }
}, 300);

modalZoom.addEventListener('input', updatePreview);
modalPosition.addEventListener('change', () => {
    positionX = 0;
    positionY = 0;
    modalPositionX.value = 0;
    modalPositionXValue.value = 0;
    modalPositionY.value = 0;
    modalPositionYValue.value = 0;
    updatePreview();
});

modalClose.addEventListener('click', () => {
    editModal.style.display = 'none';
    currentEditIndex = null;
    tempBlob = null;
    positionX = 0;
    positionY = 0;
});

saveEditBtn.addEventListener('click', async () => {
    if (currentEditIndex === null) return;

    const imageData = processedImages[currentEditIndex];
    const newZoom = parseFloat(modalZoom.value);
    const newPosition = modalPosition.value;

    status.textContent = 'Saving changes...';
    try {
        processedImages[currentEditIndex] = {
            ...imageData,
            blob: tempBlob,
            zoom: newZoom,
            position: newPosition,
            positionX: positionX,
            positionY: positionY
        };

        gallery.innerHTML = '';
        processedImages.forEach((imgData, idx) => {
            displayProcessedImage(imgData.blob, imgData.fileName, imgData.originalName, idx);
        });

        status.textContent = 'Image updated successfully!';
        editModal.style.display = 'none';
        currentEditIndex = null;
        tempBlob = null;
        positionX = 0;
        positionY = 0;
    } catch (error) {
        console.error('Error saving changes:', error);
        status.textContent = 'Error saving changes';
    }
});

document.getElementById('downloadAllBtn').addEventListener('click', async () => {
    if (processedImages.length === 0) return;

    const zip = new JSZip();
    
    processedImages.forEach(img => {
        zip.file(img.fileName, img.blob);
    });

    try {
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `profile_pics_${Date.now()}.zip`;
        link.click();
    } catch (error) {
        console.error('Error creating ZIP:', error);
        status.textContent = 'Error creating ZIP file';
    }
});

fileInput.addEventListener('change', () => {
    processedImages = [];
    downloadArea.style.display = 'none';
    gallery.innerHTML = '';
    updateUI();
});