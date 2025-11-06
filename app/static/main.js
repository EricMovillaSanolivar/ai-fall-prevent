import { serverLoadSources, serverUpdateSource, serverRemoveSource, serverLoadAlerts, serverUpdateAlert, serverRemoveAlert, sendViaGmail, sendViaTelegram } from "./backend.js";

// MENU
const $activeSources = document.querySelector("#sources");
const $activeAlerts = document.querySelector("#alerts");
const $addSource = document.querySelector("#addSource");
const $addAlert = document.querySelector("#addAlert");

// Video feed
const $videoFeed = document.querySelector("#videoFeed");

// Source modal
const $sourcesModal = document.querySelector("#sourcesModal");
// Get inner elements
const $sourceList = $sourcesModal.querySelector("#sourceList");
const $sourceAlerts = $sourcesModal.querySelector("#sourceAlerts");
const $preview = $sourcesModal.querySelector("video");
const $previewOverlay = $sourcesModal.querySelector("canvas");
const $sourceName = $sourcesModal.querySelector("#sourceName");
const $sourceCancel = $sourcesModal.querySelector(".cancel");
const $sourceAccept = $sourcesModal.querySelector(".accept");

// Alert modal
const $alertsModal = document.querySelector("#alertsModal");
const $alertCancel = $alertsModal.querySelector(".cancel");
const $alertAccept = $alertsModal.querySelector(".accept");
const $alertType = $alertsModal.querySelector("#alertType");
const $alertId = $alertsModal.querySelector("#alertId");
const $alertRecipient = $alertsModal.querySelector("#alertRecipient");
const $alertSubject = $alertsModal.querySelector("#alertSubject");
const $alertContent = $alertsModal.querySelector("#alertContent");



/** Current modal video source */
let currentModalSource;

const KEY_ACTIVE_SRC = "_src_active";
/** Available video sources */
const availableVideoSources = [];
/** Added video sources */
let activeSourcesList = [];


/** Stream tracks */
const STREAMS = {};
const VIDS = {};
/** Preview Stream */
let PREVIEW_STREAM;

/** Overlays reference */
const OVERLAYS = {};

/** ALERTS reference.*/
let ALERTS = [];



/* *********************************************************************************
********************************** UI/UX STUFF *************************************
***********************************************************************************/

/**
 * Remove video source
 * @param {object} e Event 
 */
const removeSource = (e) => {
    // Get id
    const id = e.target.getAttribute("target-id");
    // Find video source
    const source = activeSourcesList.find(src => src.name == id);
    // Confirm
    const wannaRemove = confirm(`Do you want to remove ${source.name} from video sources?`);
    // Remove source
    // if (source && wannaRemove) updateActiveSrc("remove", source, id);
    if (source && wannaRemove) serverRemoveSource(
        source.name,
        res => {
            alert(res.message);
            activeSourcesList = Object.values(res.data);
            feedSources();
        }
    );
}

/**
 * Toggle source visibility
 * @param {object} e Event 
 */
const toggleVisibility = (e) => {
    // Get id
    const id = e.target.getAttribute("target-id");
    // Find in settings
    const item = activeSourcesList.find(src => src.name == id);
    if (!item) return;
    item.hidden = !item.hidden;
    // Update
    serverUpdateSource(item.name, item, res => {
        if (res.status != "ok") return alert(res.message);
        activeSourcesList = Object.values(res.data);
        feedSources();
    })
}


/**
 * Toggle source monitoring
 * @param {object} e Event 
 */
const toggleMonitoring = (e) => {
    // Get id
    const id = e.target.getAttribute("target-id");
    // Toggle parent style
    e.target.parentNode.classList.toggle("deactivated");
    // Find in settings
    const item = activeSourcesList.find(it => it.name == id);
    if (!item) return;
    item.monitoring = !item.monitoring;
    // Update
    serverUpdateSource(item.name, item, res => {
        if (res.status != "ok") return alert(res.message);
        activeSourcesList = Object.values(res.data);
        feedSources();
    })
}


/**
 * Show sources modal and feed with available video sources
 */
const sourceRequest = (ev) => {
    // ToDo: Manage edit
    ev.preventDefault();
    const target = ev.target.getAttribute("target-id");
    // Show modal
    $sourcesModal.showModal();
    // Clear and re-feed source list
    $sourceList.innerHTML = "<option hidden value='null'>Select...</option>";
    availableVideoSources.forEach(dev => {
        $sourceList.innerHTML += `<option value="${dev.id}">${dev.name.split("(")[0]}</option>`;
    });
    // Clear and re-feed alert list
    $sourceAlerts.innerHTML = "<option hidden value='null'>Select...</option>";
    ALERTS.forEach(alrt => {
        console.log(alrt)
        $sourceAlerts.innerHTML += `<option value="${alrt.name}">${alrt.name}</option>`;
    });

    if (target) {
        const src = activeSourcesList.find(sr => sr.name == target);
        $sourceName.value = src.name;
        $sourceList.value = src.id;
        $sourceAlerts.value = src.alert;
        CURRENT_BBX = src.bbox;
    }
}


/* *********************************************************************************
********************************** VIDEO SOURCES STUFF *****************************
***********************************************************************************/


/**
 * Render active video sources
 */
const updateFeed = async () => {
    // Clear feed
    $videoFeed.innerHTML = "";
    // Choose video sources so show (selected/all)
    const sources = [...activeSourcesList].filter(src => !src.hidden);
    // Adaptative view
    const cls = sources.length > 4 ? "src3" : sources.length > 1 ? "src2" : "src1";
    $videoFeed.className = cls;

    for (let source of sources) {
        const strm = STREAMS[source.id] ? STREAMS[source.id]: await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: source.id } } });

        // Create stream reference
        if(!STREAMS[source.id]) STREAMS[source.id] = strm;
        
        const wrapper = document.createElement("div");
        // Create vid element and feed video preview
        const vid = document.createElement("video");
        vid.srcObject = strm;
        const cnv = document.createElement("canvas");
        wrapper.appendChild(vid);
        wrapper.appendChild(cnv);
        $videoFeed.appendChild(wrapper);
        vid.play();
        // On video loaded update canvas size
        vid.addEventListener("playing", () => {
                const { width, height } = vid.getBoundingClientRect();
                // Update canvas size
                cnv.style.width = width + "px";
                cnv.style.height = height + "px";
                cnv.width = width;
                cnv.height = height;
            });
        // Update overlay reference
        OVERLAYS[source.name] = { canvas: cnv, ctx: cnv.getContext("2d") };
        VIDS[source.name] = vid;
    }
}


/**
 * Render video sources on menu
 */
const feedSources = () => {
    $activeSources.innerHTML = "";
    for (let src of activeSourcesList) {
        const name = src.name.split("(")[0];
        // Parent list element
        const li = document.createElement("li");
        li.className = src.monitoring ? "": "deactivated";
        li.title = "Press left click to edit source.";
        // Device label
        const span = document.createElement("span");
        span.innerHTML = `${name}<strong>Channel: ${src.alert}</strong>`;
        span.setAttribute("target-id", src.name);
        span.addEventListener("click", toggleMonitoring);
        span.addEventListener("contextmenu", sourceRequest);
        li.appendChild(span);
        // Visibility state
        const hidden = document.createElement("input");
        hidden.setAttribute("target-id", src.name);
        hidden.addEventListener("change", toggleVisibility);
        hidden.type = "checkbox";
        hidden.checked = src.hidden;
        li.appendChild(hidden);
        // Delete button
        const delBtn = document.createElement("button");
        delBtn.setAttribute("target-id", src.name);
        delBtn.addEventListener("click", removeSource);
        li.appendChild(delBtn);
        $activeSources.appendChild(li);
    }
    updateFeed();
}


/* *********************************************************************************
********************************** FENCES STUFF ************************************
***********************************************************************************/

let CURRENT_BBX;

/**
 * Finds a geofence using interactive segmentation runing on backend
 * @param {event} ev Event used to retrieve the video element
 */
const findGeofence = (ev) => {
    try {
        const vid = ev.target;
        // Get source video size
        const w = vid.videoWidth;
        const h = vid.videoHeight;
        // Map cursor position in image space
        const { width, height } = vid.getBoundingClientRect();
        const x = map(ev.offsetX, 0, width, 0, 1);
        const y = map(ev.offsetY, 0, height, 0, 1);
        // Get frame
        getFrame(vid, w, h)
            .then(frame => {
                // Build request params
                const form = new FormData();
                form.append("x", x);
                form.append("y", y);
                form.append("normalized", true);
                form.append("image", frame)
                // Request geofence
                fetch("/vision/segment", {
                        method: "POST",
                        body: form
                    })
                    .then(req => req.json())
                    .then(res => {
                        // Retrieve mask
                        const mask = res.detections.confidence_mask;
                        if (mask) {
                            // Build geofence
                            findCornerPixelsFromMask(mask)
                                .then( bbx => {
                                    CURRENT_BBX = [...bbx];
                                    // Draw bbx on preview canvas
                                    const ctx = $previewOverlay.getContext("2d");
                                    const { width: w, height: h } = $preview.getBoundingClientRect();
                                    $previewOverlay.width = w;
                                    $previewOverlay.height = h;
                                    ctx.clearRect(0, 0, w, h);
                                    ctx.strokeStyle = "#0f0";
                                    ctx.strokeWidth = 3;
                                    ctx.rect(bbx[0] * w, bbx[1] * h, (bbx[2] - bbx[0]) * w, (bbx[3] - bbx[1]) * h);
                                    ctx.stroke();
                                });
                        }
                    })
                    .catch(err => console.error(`Error while trying to request segmentation: ${err}`));

            });

    } catch (err) {
        console.error(`Error while trying to find a geofence: ${err}`);
    }
}

/* *********************************************************************************
********************************** CANVAS STUFF ************************************
***********************************************************************************/


/**
 * Get current video frame
 * @param {object} source HTML video tag reference 
 */
const getFrame = (source, w, h, base64 = false) => {
    return new Promise((resolve, reject) => {
        try {
            // Create a canvas
            const cnv = document.createElement("canvas");
            const ctx = cnv.getContext("2d");
            // Apply size to canvas
            cnv.width = w;
            cnv.height = h;
            // Draw current frame
            ctx.drawImage(source, 0, 0, w, h);
            // Return blob or base64
            if (!base64) cnv.toBlob(blob => resolve(blob), "image/jpeg", 1);
            else resolve(cnv.toDataURL("image/jpeg", 1));
        } catch (err) {
            reject(err);
        }
    })
}

/**
 * Clear overlay canvas of video source
 * @param {object} src Video source
 * @returns 
 */
const clearCanvas = (src) => {
    const ctx = OVERLAYS[src.name]?.ctx;
    if (!ctx) return;
    // Retrieve canvas size
    const { width, height } = OVERLAYS[src.name].canvas.getBoundingClientRect();
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
}

/**
 * Draw fence for a source
 * @param {object} src Source object
 */
const drawBbox = (src) => {
    if (!src.bbox || src.hidden) return;
    // Retrieve FENCES and context
    const ctx = OVERLAYS[src.name].ctx;
    const bbx = src.bbox;
    // Retrieve canvas size
    const { width, height } = OVERLAYS[src.name].canvas.getBoundingClientRect();
    // Draw a black overlay
    ctx.beginPath();
    ctx.fillStyle = "#0003";
    ctx.rect(0, 0, width, height);
    ctx.fill();
    ctx.closePath();
    // Remove black overlay over fence area (hole)
    ctx.clearRect(bbx[0] * width, bbx[1] * height, (bbx[2] - bbx[0]) * width, (bbx[3] - bbx[1]) * height);
    // Draw path
    ctx.strokeStyle = "lime";
    ctx.strokeWidth = 3;
    ctx.beginPath();
    ctx.rect(bbx[0] * width, bbx[1] * height, (bbx[2] - bbx[0]) * width, (bbx[3] - bbx[1]) * height);
    ctx.stroke();
    ctx.closePath();
    // Returns the fence
    return fence;
}

/**
 * Draw user pose on overlay
 * @param {object} detections Detection result
 * @param {object} src Video source object
 */
const drawPose = (detections, src) => {
    if (detections.length == 0) return;
    // Retrieve FENCES and context
    const ctx = OVERLAYS[src.name].ctx;
    // Retrieve canvas size
    const { width, height } = OVERLAYS[src.name].canvas.getBoundingClientRect();
    // Loop thru keypoints
    for (let kp of detections[0].keypoints) {
        if (kp.x > 1 || kp.y > 1) continue;
        // Draw point for keypoint
        ctx.beginPath();
        ctx.arc(kp.x * width, kp.y * height, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#f00";
        ctx.fill();
    }
    // Returns the detection result
    return detections[0].keypoints;
}


/* *********************************************************************************
********************************** ALERTS STUFF ************************************
***********************************************************************************/

/**
 * Show alerts modal
 */
const alertRequest = () => {
    $alertsModal.showModal();
}


/**
 * Render available fences in the menu
 */
const feedAlerts = () => {
    $activeAlerts.innerHTML = "";
    for (let alrt of ALERTS) {
        const name = alrt.name;
        // Parent list element
        const li = document.createElement("li");
        // Device label
        const span = document.createElement("span");
        span.innerHTML = `${name}<strong>${alrt.type}</strong>`;
        span.setAttribute("target-id", name);
        li.appendChild(span);
        // Delete button
        const delBtn = document.createElement("button");
        delBtn.setAttribute("target-id", name);
        delBtn.addEventListener("click", e => {
            serverRemoveAlert(e.target.getAttribute("target-id"), res => alert(res.message));
        });
        li.appendChild(delBtn);
        $activeAlerts.appendChild(li);
    }
}

const processNewAlert = async (e) => {
    // Retrieve type
    const type = $alertType.value;
    // Retrieve id
    const id = $alertId.value;
    // Retrieve recipient
    const recipient = $alertRecipient.value;
    // Retrieve subject
    const subject = $alertSubject.value;
    // Retrieve content
    const content = $alertContent.value;
    if (!type || type == "") return alert("You should select a type of alert.");
    if (content == "") return alert("Theres no content for the alert.");
    if (!content.includes("[fence]")) return alert("You should include [fence] placeholder in your content.");
    if (recipient == "") return alert(`Recipient field can't be empty. You should put your ${type == "mail" ? "comma separated emails": type == "telegram" ? "Telegram chat_id": "Lang code (es, en ...)"} here.`);
    
    let alrt;
    switch (type) {
        case "local":
            alrt = { type, content, id: null };
            break;
        default:
            if (id == "") return alert(`Id field can't be empty. You should put your ${type == "mail" ? "AppScript Id": "Telegram BotToken"} here.`);
            if (recipient == "") return alert(`Recipient field can't be empty. You should put your ${type == "mail" ? "comma separated emails": "Telegram chat_id"} here.`);
            if (subject == "") return alert(`Subject field can't be empty.`);
            alrt = { type, id, recipient, subject, content, id: null};
            break;
    }

    let name;
    while (true) {
        name = prompt("Please provide an unique name for this alert: ");
        if(name != "") {
            // Validate another alert with this name
            const alrtNamed = ALERTS.find(al => al.name == name);
            if (alrtNamed) {
                alert("This alert name is already taken.");
                continue;
            }
            // Save alert
            serverUpdateAlert(
                name, 
                { id, name, type, recipient, content, subject},
                res => {
                    alert(res.message);
                    console.log(res);
                    if (res.status == "ok"){
                        ALERTS = Object.values(res.data);
                        feedAlerts();
                    }
                }
            );
            break;
        } else {
            break;
        }
    }
}

let isSpeaking = false;
const processAlert = (alert, src) => {
    const currTime = new Date().getTime();
    // 30 seconds timeout
    if (alert.type != "local") {
        if (src.timeout && currTime - src.timeout < 30000) return;
        activeSourcesList.find(sr => sr.name == src.name).timeout = currTime;
    }

    // Retrieve fence name
    const name = src.name;
    // Customize alert
    const content = alert.content.replace("[fence]", name);
    // Process type of alert
    switch(alert.type){
        case "local":
            if (isSpeaking) return;
            console.log("Synthesis request")
            isSpeaking = true;
            // Speech synthesis
            const utt = new SpeechSynthesisUtterance(content);
            // Customize speech synthesis
            utt.lang = alert.recipient;
            utt.rate = 0.9;
            // Reset speech status
            utt.onend = e => setTimeout(() => {
                isSpeaking = false;
            }, 1500);
            // Request synthesis
            speechSynthesis.speak(utt);
            break;
        
        case "mail":
            // Retrieve base64 image
            getFrame(VIDS[src.name], 1280, 960, true)
                .then(frame => {
                    let attachment = [{ name: "evidence.jpg", contentType: "image/jpeg", base64: frame.split(",")[1] }];
                    // Request email send
                    sendViaGmail(alert.id, alert.recipient, alert.subject, content, attachment);
                });
            break;
        
        case "telegram":
            // Retrieve blob image
            getFrame(VIDS[src.name], 1280, 960, false)
                .then(frame => {
                    // Request message send
                    sendViaTelegram(alert.id, alert.recipient, alert.subject, content, frame);
                })
            break;
    }
}


/* *********************************************************************************
********************************** PIPELINE ****************************************
***********************************************************************************/

const pipeline = () => {
    // Filter monitored sources
    const monitoring = [...activeSourcesList].filter(src => src.monitoring);
    // Validate there are sources for monitoring
    if (monitoring.length == 0) {
        for (let src of activeSourcesList) {
            clearCanvas(src);
            drawBbox(src);
        }
        setTimeout(() => {
            requestAnimationFrame(pipeline);
        }, 100);
        return;
    }
    console.time("pipeline time");
    // Build frames
    const framesPromise = [];
    for (let src of monitoring) {
        framesPromise.push(new Promise((resolve,reject) => {
            getFrame(VIDS[src.name], 640, 480)
                .then(res => resolve({ src: src, frame: res }))
                .catch(err => {
                    console.log(err);
                    resolve(null);
                })
        }))
    }
    // Request frames
    Promise.all(framesPromise)
        .then(responses => {
            // Request poses
            const posePromises = [];
            for (let res of responses) {
                if (res == null) continue;
                posePromises.push(new Promise((resolve) => {
                    requestPose(res.frame)
                        .catch(err => {
                            console.error(err)
                            resolve(null)
                        })
                        .then(det => {
                            det.src = res.src;
                            resolve(det);
                        })
                }))
            }
            Promise.all(posePromises)
                .catch(err => console.error(err))
                .then(dets => {
                    for (let src of activeSourcesList) {
                        clearCanvas(src);
                        drawBbox(src);
                    }
                    // Draw each box and keypoints
                    for (let det of dets) {
                        if (det.status != "ok") continue;
                        // Draw pose
                        const keyp = drawPose(det.detections, det.src);
                        // Check hand up
                        const lw = keyp.find(kp => kp.name == "leftWrist");
                        const rw = keyp.find(kp => kp.name == "rightWrist");
                        const ls = keyp.find(kp => kp.name == "leftShoulder");
                        const rs = keyp.find(kp => kp.name == "rightShoulder");

                        if (lw.y < ls.y || rw.y < rs.y){
                            // Dispatch in situ alert
                            processAlert({ 
                                type: "local", 
                                recipient: "en",
                                content: "Wait a moment [fence]. You will be attended in a moment."
                            }, det.src);
                            // Dispatch default alert
                            let modAlert = ALERTS.find(al => al.name == det.src.alert);
                            if( modAlert ) {
                                modAlert = {...modAlert};
                                modAlert.content = "User [fence] needs your help. Please attend him";
                                modAlert.subject = "An user needs help!";
                                console.log(modAlert);
                                processAlert(modAlert, det.src);
                            }
                            // const alrt = 
                            continue;
                        }
                        // Check for collisions
                        checkCollision(keyp, det.src);
                    }
                    console.timeEnd("pipeline time");
                    requestAnimationFrame(pipeline);
                })
        })
        .catch(err => console.error(err));
}


/**
 * Performs pose detection on the backend
 * @param {blob} frame Current video frame 
 * @returns 
 */
const requestPose = async (frame) => {
    if (!frame) return;
    // Build form
    const form = new FormData();
    form.append("image", frame);
    form.append("normalized", true);
    // Send request
    const request = await fetch("/vision/pose", {
            method: "POST",
            body: form
        })
    // Process response
    const response = await request.json();
    return response;
}


/**
 * Check for collisions between the user with his respective fence
 * @param {object} fence User fence
 * @param {object} pose User pose
 * @param {object} src Video source object
 * @returns 
 */
const checkCollision = (pose, src) => {
    if (!pose || !src.alert) return;
    // Search alert
    const alrt = ALERTS.find(al => al.name == src.alert);
    if (!alrt) return;
    // Filter keypoints outside visible area
    const kpFiltered = pose.filter(kp => kp.x < 1 && kp.y < 1);
    // Retrieve fence bbox
    const [minx , miny, maxx, maxy] = src.bbox;
    // check for collision
    let collisions = 0;
    for (let kp of kpFiltered) {
        if (
            kp.x < minx ||
            kp.x > maxx ||
            kp.y < miny ||
            kp.y > maxy
        ){
            console.log(kp);
            if (collisions >= 1) break;
            collisions++;
        }
    }
    if (collisions >= 1) processAlert(alrt, src);
}


/* *********************************************************************************
********************************** MISC STUFF **************************************
***********************************************************************************/

/**
 * Find rectangular bbox corners from a base64 grayscale/black mask.
 * Returns corners in the same order as before: [topLeft, topRight, bottomRight, bottomLeft],
 * with normalized coordinates (x/w, y/h).
 * Comments in English.
 * 
 * @param {string} base64 - Data URL (e.g. "data:image/png;base64,...")
 * @param {number} [threshold=20] - 0..255 intensity threshold to consider a pixel as non-black
 * @returns {Promise<Array<{x:number,y:number}|undefined>>} [tl, tr, br, bl]
 */
function findCornerPixelsFromMask(base64, threshold = 20) {
  return new Promise((resolve, reject) => {
    // 1) Load the image
    const img = new Image();
    img.onload = () => {
      // 2) Draw into an offscreen canvas
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);

      // 3) Read pixel data
      const { width: w, height: h } = canvas;
      const { data } = ctx.getImageData(0, 0, w, h); // RGBA flat array

      // Helper: consider pixel non-black if red channel >= threshold
      // (keeps your simplified rule)
      const isNonBlack = (x, y) => {
        const i = (y * w + x) * 4;
        const r = data[i];
        return r >= threshold;
      };

      // 4) One pass to compute bbox over all non-black pixels
      let minX = w, minY = h, maxX = -1, maxY = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (isNonBlack(x, y)) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }

      // 5) Build bbox (if any non-black pixel was found)
      const bbox = [minX / w, minY / h, maxX / w, maxY / h];

      resolve(bbox);
    };

    img.onerror = () => reject(new Error('Failed to load base64 image'));
    img.crossOrigin = 'anonymous';
    img.src = base64;
  });
}

/**
 * Map a value into a new range
 * @param {float} val Value to map
 * @param {float} smin Source range min value
 * @param {float} smax Source range max value
 * @param {float} tmin Target range min value
 * @param {float} tmax Target range max value
 * @returns 
 */
const map = (val, smin, smax, tmin, tmax) => {
    return tmin + (tmax - tmin) * ((val - smin) / (smax - smin));
}


/* *********************************************************************************
********************************** SETUP STUFF *************************************
***********************************************************************************/
/**
 * Initial setup
 */
const setUp = async () => {
    // Get video sources
    navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
        // Release video source after permissions
        stream.getTracks().forEach(track => track.stop());
        // Get all video sources
        navigator.mediaDevices.enumerateDevices().then(devs => {
            devs = devs.filter(dev => dev.kind == "videoinput");
            // Add each device
            devs.forEach(dev => {
                // Assign default values
                const item = {
                    monitoring: true,
                    hidden: false,
                    fence: null,
                    id: dev.deviceId,
                    name: dev.label
                }
                // Add to available sources list
                availableVideoSources.push(item);
            });
        })
    })

    // Add source event listener
    $addSource.addEventListener("click", sourceRequest);

    // Show preview listener
    $sourceList.addEventListener("change", e => {
        navigator.mediaDevices.getUserMedia({ video: { deviceId:{ exact: e.target.value }} })
            .then(stream => {
                PREVIEW_STREAM = stream;
                currentModalSource = e.target.value;
                $preview.srcObject = stream;
                $preview.play();
            })
    })

    // Add modal close event
    $sourceCancel.addEventListener("click", e => {
        $sourcesModal.close();
        if (PREVIEW_STREAM) PREVIEW_STREAM.getTracks().forEach(track => track.stop());
        PREVIEW_STREAM = undefined;
    });

    // Add modal accept event
    $sourceAccept.addEventListener("click", e => {
        // Retrieve name
        let name = $sourceName.value;
        // Retrieve alert channel
        const alrt = $sourceAlerts.value;
        // Retrieve video source
        const videoSrc = $sourceList.value;
        // Validate data
        if (videoSrc == "null") return alert("Please select a video source first.");
        if (!name) return alert("Please assign an unique name to your video source");
        if (alrt == "null") alert("Source will be saved but not monitored because there's not an alert channel selected.");
        if (CURRENT_BBX == undefined) alert("Source will be saved but not monitored because there's not a fence.");
        
        // Validate if the source exists
        const srcExists = activeSourcesList.find(src => src.name == name);

        // Advertise the user for overwriting existing sources
        if (srcExists) {
            while (true) {
                // Confirm an overwrite
                let cnfrm = confirm(`The provided name "${srcExists.name}" already exists. Do you wanna override this?`);
                if (cnfrm) break;
                else {
                    // Ask a new name if the user don't wanna override
                    while (true) {
                        let newName = prompt("Please provide the new name for this source: ");
                        // Validate another source with the new name
                        const newSrcExists = activeSourcesList.find(src => src.name == newName);
                        if (newSrcExists) alert("This name also exists.");
                        else {
                            name = newName;
                            break;
                        }
                    }
                    break;
                }
            }
        } 

        // Permorm update
        serverUpdateSource(
            name, 
            {
                name, id: videoSrc,
                bbox: CURRENT_BBX ? [...CURRENT_BBX]: null, monitoring: false, hidden: false, alert: alrt
            },
            res => {
                activeSourcesList = Object.values(res.data);
                alert(res.message);
                CURRENT_BBX = undefined;
                $sourcesModal.close();
                feedSources();
            }
        );
    })

    // Retrieve sources from server
    serverLoadSources(res => {
        activeSourcesList = Object.values(res);
        feedSources();
    });

    // Add alerts event listener
    $addAlert.addEventListener("click", alertRequest);
    $alertAccept.addEventListener("click", processNewAlert);
    $alertCancel.addEventListener("click", e => $alertsModal.close());

    // Retrieve alerts from server
    serverLoadAlerts(alrts => {
        ALERTS = Object.values(alrts);
        feedAlerts();
    });

    setTimeout(() => {
        pipeline();
    }, 4000);
}


setUp();


$preview.addEventListener("click", findGeofence);