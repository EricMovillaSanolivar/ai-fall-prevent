import { serverLoadFences, serverUpdateFence, serverRemoveFence, serverLoadAlerts, serverUpdateAlert, serverRemoveAlert, sendViaGmail, sendViaTelegram } from "./backend.js";

// MENU
const $activeSources = document.querySelector("#sources");
const $activeFences = document.querySelector("#fences");
const $activeAlerts = document.querySelector("#alerts");
const $addSource = document.querySelector("#addSource");
const $addAlert = document.querySelector("#addAlert");

// Video feed
const $videoFeed = document.querySelector("#videoFeed");

// Source modal
const $sourcesModal = document.querySelector("#sourcesModal");
// Get inner elements
const $sourceList = $sourcesModal.querySelector("#sourceList");
const $preview = $sourcesModal.querySelector("video");
const $sourceCancel = $sourcesModal.querySelector(".cancel");
const $sourceAccept = $sourcesModal.querySelector(".accept");
// Geofence Toggle
const $geofenceToggle = document.querySelector("#geofenceToggle");
// Fence modal
const $fencesModal = document.querySelector("#fencesModal");
const $setFencesList = $fencesModal.querySelector("#setFencesList");
const $setAlertsList = $fencesModal.querySelector("#setAlertsList");
const $fenceCancel = $fencesModal.querySelector(".cancel");
const $fenceAccept = $fencesModal.querySelector(".accept");

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


/** Geofence search engine enabled */
let geoSearchEnabled = false;
/** FENCES reference.*/
let FENCES = [];


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
    const source = activeSourcesList.find(src => src.id == id);
    // Confirm
    const wannaRemove = confirm(`Do you want to remove ${source.name} from video sources?`);
    // Remove source
    if (source && wannaRemove) updateActiveSrc("remove", source, id);
}

/**
 * Toggle source visibility
 * @param {object} e Event 
 */
const toggleVisibility = (e) => {
    // Get id
    const id = e.target.getAttribute("target-id");
    // Find in settings
    const item = activeSourcesList.find(src => src.id == id);
    // Update
    updateActiveSrc("update", { hidden: !item.hidden }, id);
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
    const item = activeSourcesList.find(it => it.id == id);
    // Toggle
    updateActiveSrc("update", { monitoring: !item.monitoring }, id);
}


/**
 * Show sources modal and feed with available video sources
 */
const sourceRequest = () => {
    // Show modal
    $sourcesModal.showModal();
    // Clear and re-feed source list
    $sourceList.innerHTML = "<option hidden>Select...</option>"
    availableVideoSources.forEach(dev => {
        $sourceList.innerHTML += `<option value="${dev.id}">${dev.name.split("(")[0]}</option>`;
    });
}


/**
 * Remove fence
 * @param {object} e Event 
 */
const removeFence = (e) => {
    // Get id
    const id = e.target.getAttribute("target-id");
    // Find fence source
    const fence = [...FENCES].find(fnc => fnc.name == id);
    if (!fence) return;
    // Find source video using this fence
    const src = [...activeSourcesList].find(src => src.fence == fence.name);
    // Confirm
    const wannaRemove = confirm(`Do you want to remove the fence named '${fence.name}'?\n${!src ? "": "Fence is being used by " + src.name }`);
    // Remove source
    if (wannaRemove) {
        serverRemoveFence(id, e => {
            alert(res.message);
            FENCES = Object.values(res.data);
            feedFences();
        });
        if (src) updateActiveSrc("update", { fence: null }, src.id);
    }
}


/**
 * Show modal and feed with available fences
 */
const fenceRequest = (ev) => {
    ev.preventDefault();
    // Show modal
    $fencesModal.showModal();
    // Search source
    const src = activeSourcesList.find(src => src.id == ev.target.getAttribute("target-id"));
    // Update title
    $fencesModal.querySelector("#fenceTarget").textContent = src.name;
    // Clear and re-feed source list
    $setFencesList.innerHTML = "<option hidden>Select...</option>"
    FENCES.forEach(fence => {
        $setFencesList.innerHTML += `<option value="${fence.name}">${fence.name}</option>`;
    });
    // add id to accept button
    $fenceAccept.setAttribute("target-id", src.id);
}


/* *********************************************************************************
********************************** VIDEO SOURCES STUFF *****************************
***********************************************************************************/

/**
 * Update active video sources list syncing with session storage
 * @param {string} does Action to execute add/update/remove 
 * @param {*} id 
 * @param {*} newItem 
 * @returns 
 */
const updateActiveSrc = (does, newItem, id) => {
    switch(does){
        case "add":
            // Add the new item
            activeSourcesList.push(newItem);
            break;
        case "update":
            // Update source
            const item = activeSourcesList.find(src => src.id == id);
            if (!item) return;
            // Loop thru all new item properties to update the current item
            for (let key of Object.keys(newItem)) {
                item[key] = newItem[key];
            }
            break;
        case "remove":
            // Remove the item
            activeSourcesList.splice(activeSourcesList.indexOf(newItem), 1);
            break;
    }
    // Update on session storage
    sessionStorage.setItem(KEY_ACTIVE_SRC, JSON.stringify(activeSourcesList));
    // Re render
    updateFeed();
}

/**
 * Render active video sources
 */
const updateFeed = async () => {
    // Clear feed
    $videoFeed.innerHTML = "";
    // Choose video sources so show (selected/all)
    const sources = [...activeSourcesList].filter(src => src.hidden == false);
    // Adaptative view
    const cls = sources.length > 4 ? "src3" : sources.length > 1 ? "src2" : "src1";
    $videoFeed.className = cls;

    for (let source of sources) {
        const strm = STREAMS[source.id] ? STREAMS[source.id]: await navigator.mediaDevices.getUserMedia({ video: { deviceId: source.id } });

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
        // Assign id and targets
        vid.setAttribute("target-id", source.id);
        // Add click event listener for geofence search
        vid.addEventListener("click", findGeofence);
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
        OVERLAYS[source.id] = { canvas: cnv, ctx: cnv.getContext("2d") };
        VIDS[source.id] = vid;
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
        // Device label
        const span = document.createElement("span");
        span.textContent = name;
        span.setAttribute("target-id", src.id);
        span.addEventListener("click", toggleMonitoring);
        span.addEventListener("contextmenu", fenceRequest);
        li.appendChild(span);
        // Visibility state
        const hidden = document.createElement("input");
        hidden.setAttribute("target-id", src.id);
        hidden.addEventListener("change", toggleVisibility);
        hidden.type = "checkbox";
        hidden.checked = src.hidden;
        li.appendChild(hidden);
        // Delete button
        const delBtn = document.createElement("button");
        delBtn.setAttribute("target-id", src.id);
        delBtn.addEventListener("click", removeSource);
        li.appendChild(delBtn);
        $activeSources.appendChild(li);
    }
    updateFeed();
}


/* *********************************************************************************
********************************** FENCES STUFF ************************************
***********************************************************************************/
/**
 * Render available fences in the menu
 */
const feedFences = () => {
    $activeFences.innerHTML = "";
    for (let fence of FENCES) {
        const name = fence.name;
        // Parent list element
        const li = document.createElement("li");
        // Device label
        const span = document.createElement("span");
        span.textContent = name;
        span.setAttribute("target-id", name);
        // span.addEventListener("click", toggleMonitoring);
        li.appendChild(span);
        // Delete button
        const delBtn = document.createElement("button");
        delBtn.setAttribute("target-id", name);
        delBtn.addEventListener("click", removeFence);
        li.appendChild(delBtn);
        $activeFences.appendChild(li);
    }
}

/**
 * Toggle geofence search status
 */
const geoToggle = () => {
    // Show crosshair cursor
    document.body.classList.toggle("crosshair");
    $geofenceToggle.classList.toggle("active");
    // Toggle geofence search status
    geoSearchEnabled = !geoSearchEnabled;
}

/**
 * Finds a geofence using interactive segmentation runing on backend
 * @param {event} ev Event used to retrieve the video element
 */
const findGeofence = (ev) => {
    if (!geoSearchEnabled) return;
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
                                    const targetId = vid.getAttribute("target-id");
                                    FENCES[targetId] = bbx;
                                    // Give enough time to draw the fence
                                    setTimeout(async () => {
                                        const fName = await prompt("Please name your fence: ");
                                        if (fName != "" && fName != null) {
                                            // Search existent fence
                                            let fence = [...FENCES].find(item => item.name == fName);
                                            if (fence) return alert("This fence name is already taken. Please review fence names.");
                                            const id = vid.getAttribute("target-id");
                                            // Update source
                                            updateActiveSrc("update", { fence: fName }, id);
                                            // Update server storage
                                            fence = {
                                                name: fName,
                                                id: id,
                                                bbox: bbx
                                            }
                                            serverUpdateFence(fName, fence, res => {
                                                alert(res.message);
                                                FENCES = Object.values(res.data);
                                                feedFences();
                                            });
                                        }
                                    }, 50);
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
    const ctx = OVERLAYS[src.id]?.ctx;
    if (!ctx) return;
    // Retrieve canvas size
    const { width, height } = OVERLAYS[src.id].canvas.getBoundingClientRect();
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
}

/**
 * Draw fence for a source
 * @param {object} src Source object
 */
const drawBbox = (src) => {
    if (!src.fence) return;
    // Retrieve FENCES and context
    const ctx = OVERLAYS[src.id].ctx;
    const fence = [...FENCES].find(fen => fen.name == src.fence);
    if (!fence) return;
    const bbx = fence.bbox;
    // Retrieve canvas size
    const { width, height } = OVERLAYS[src.id].canvas.getBoundingClientRect();
    // Draw a black overlay
    ctx.beginPath();
    ctx.fillStyle = "#0005";
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
    const ctx = OVERLAYS[src.id].ctx;
    // Retrieve canvas size
    const { width, height } = OVERLAYS[src.id].canvas.getBoundingClientRect();
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
********************************** PIPELINE ****************************************
***********************************************************************************/

const pipeline = () => {
    // Filter monitored sources
    const monitoring = [...activeSourcesList].filter(src => src.monitoring == true);
    // Validate there are sources for monitoring
    if (monitoring.length == 0) {
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
            getFrame(VIDS[src.id], 640, 480)
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
                        // Clear all canvases
                        for (let src of activeSourcesList) {
                            clearCanvas(src);
                        }
                        // Draw each box and keypoints
                        for (let det of dets) {
                            // Draw fence
                            const fence = drawBbox(det.src);
                            // Draw pose
                            const keyp = drawPose(det.detections, det.src);
                            // Check for collisions
                            checkCollision(fence, keyp, det.src);
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
const checkCollision = (fence, pose, src) => {
    if (!fence || !pose || !src.alert) return;
    // Filter keypoints outside visible area
    const kpFiltered = pose.filter(kp => kp.x < 1 && kp.y < 1);
    // Retrieve fence bbox
    const [minx , maxx, miny, maxy] = fence.bbox;
    // check for collision
    for (let kp of kpFiltered) {
        if (
            kp.x < minx ||
            kp.x > maxx ||
            kp.y < miny ||
            kp.y > maxy
        ){
            // Search alert
            // Retrieve image
            getFrame(VIDS[src.id], 1280, 720, true)
                .then(img => {
                    // Process alert
                    
                    testAlert(`The user on the fence: '${src.fence}', is under high fall risk.`, [{name: "evicende.jpg", contentType: "image/jpeg", base64: img.split(",")[1]}]);
                });
            break;
        }
    }
}

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
        span.textContent = name;
        span.setAttribute("target-id", name);
        // span.addEventListener("click", toggleMonitoring);
        li.appendChild(span);
        // Delete button
        const delBtn = document.createElement("button");
        delBtn.setAttribute("target-id", name);
        delBtn.addEventListener("click", removeAlert);
        li.appendChild(delBtn);
        $activeAlerts.appendChild(li);
    }
}

const removeAlert = () => {

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
        if(name) {

        } else {
            break;
        }
    }
}

// let speaking = false;
const testAlert = (content, images) => {
    if(speaking) return;
    speaking = true;
    const utt = new SpeechSynthesisUtterance(content);
    utt.onend = e => setTimeout(() => {
        speaking = false;
    }, 2000);
    utt.lang = "en";
    utt.rate = 1.2;
    speechSynthesis.speak(utt);
    sendViaGmail(null, "fraktlabs@gmail.com", "Possible fall alert!!", content, images)
        .then(res => console.log(res))
        .catch(err => {
            console.error(err);
        });
}


let isSpeaking = false;
const processAlert = (alert, name, attachment) => {
    // Customize alert
    const content = alert.content.replace("[fence]", name);
    // Process type of alert
    switch(alert.type){
        case "local":
            if (isSpeaking) return;
            isSpeaking = true;
            // Speech synthesis
            const utt = new SpeechSynthesisUtterance(content);
            // Customize speech synthesis
            utt.lang = alert.recipient;
            utt.rate = 1.1;
            // Reset speech status
            utt.onend = e => setTimeout(() => {
                isSpeaking = false;
            }, 1500);
            // Request synthesis
            speechSynthesis.speak(utt);
            break;
        
        case "mail":
            // Request email send
            sendViaGmail(alert.id, alert.recipient, alert.subject, content, attachment);
            break;
        
        case "telegram":
            // Customize alert
            content = alert.content.replace("<user>", name);
            // Request email send
            sendViaGmail(alert.id, alert.recipient, alert.subject, content, attachment);
            // Request message send
            break;
    }
}


/* *********************************************************************************
********************************** SETUP STUFF *************************************
***********************************************************************************/
/**
 * Initial setup
 */
const setUp = async () => {
    // Validate token or logout
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
        navigator.mediaDevices.getUserMedia({ video: { deviceId: e.target.value } })
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
        // Find source video
        const current = [...availableVideoSources].find(val => val.id == currentModalSource);
        // Add video source to current active sources
        current.fence = null;
        current.monitoring = false;
        current.hidden = false;
        updateActiveSrc("add", current);
        // Close modal
        $sourcesModal.close();
        if (PREVIEW_STREAM) PREVIEW_STREAM.getTracks().forEach(track => track.stop());
        PREVIEW_STREAM = undefined;
        // Re render
        feedSources();
    })

    // Search fence button
    $geofenceToggle.addEventListener("click", geoToggle);
    $fenceCancel.addEventListener("click", e => $fencesModal.close());
    $fenceAccept.addEventListener("click", e => {
        const id = e.target.getAttribute("target-id");
        const fence = $setFencesList.value;
        if (!id || !fence){
            $fencesModal.close();
            return alert("Something went wrong while trying to update fence");
        } 
        // Update source
        updateActiveSrc("update", { fence: fence }, id);
        // Find fence and update on server
        const fenceObj = [...FENCES].find(fen => fen.name == fence);
        fenceObj.id = id;
        serverUpdateFence(fence, fenceObj, res => {
            alert(res.message);
            FENCES = Object.values(res.data);
            feedFences();
        });
        $fencesModal.close();
    });

    // Retrieve session storage active sources
    const sources = await sessionStorage.getItem(KEY_ACTIVE_SRC);
    if (sources) {
        try {
            const json = JSON.parse(sources);
            if(!json) return;
            activeSourcesList = [...json];
            feedSources();
        } catch (err) {
            console.error("Failed to load active src config from session storage due to:", err)
        }
    }

    // Add alerts event listener
    $addAlert.addEventListener("click", alertRequest);
    $alertAccept.addEventListener("click", processNewAlert);
    $alertCancel.addEventListener("click", e => $alertsModal.close());

    // Retrieve fences from server
    serverLoadFences(fencs => {
        FENCES = Object.values(fencs);
        feedFences();
    });

    // Retrieve alerts from server
    serverLoadAlerts(alrts => {
        ALERTS = Object.values(alrts);
        feedAlerts();
    });
}


setUp();
