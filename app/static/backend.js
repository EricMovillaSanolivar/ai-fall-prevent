

/******************************************************************************************** *
 * ********************************** ALERTS STUFF ****************************************** *
 * *******************************************************************************************/

/**
 * Send alert via gmail
 * 
 * AppScript must be up
 * @param {string} id AppScript ID
 * @param {string} emails Comma separated emails
 * @param {string} subject Subject of the e-mail
 * @param {string} content Content of the e-mail
 * @param {object} attachments Base64 attachments in format: [{name: "name_of_attachment.jpg", contentType: "image/jpeg", base64: "without header"}]
 */
const sendViaGmail = (id, emails, subject, content, attachments) => {
    return new Promise((resolve, reject) => {
        fetch("/alerts/mail", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // Build body for backend
                body: JSON.stringify({
                    id,
                    data: {
                        emails,
                        subject,
                        content,
                        attachments
                    }
                })
            }).then(res => res.json())
            .then(resp => {
                console.log(resp)
                resolve(resp)
            })
            .catch(err => reject(err));
    })
}


/**
 * Send alert via telegram
 * 
 * Bot and chat must be set up
 * @param {string} id Telegram bot token
 * @param {string} chat Chat id
 * @param {string} subject Subject of the alert message
 * @param {string} content Content of the alert message
 * @param {object} attachment Blob image
 */
const sendViaTelegram = (id, chat, subject, content, attachment) => {
    // Build from
    const form = new FormData();
    form.append("id", id);
    form.append("chat_id", chat)
    form.append("content", `${subject}\n${content}`);
    form.append("image", attachment, "image/jpeg");
    // Send request
    return new Promise((resolve, reject) => {
        fetch("/alerts/telegram", {
                method: "POST",
                body: form
            }).then(res => res.json())
            .then(resp => {
                console.log(resp);
                resolve(resp);
            })
            .catch(err => reject(err));
    })
}


/******************************************************************************************** *
 * ********************************** FENCES STUFF ****************************************** *
 * *******************************************************************************************/
/**
 * Load fences from server
 * @param {function} callback Function to execute when a response is received. 
 */
const serverLoadFences = (callback) => {
    fetch("/fences/load")
        .then(req => req.json())
        .then(res => {
            if (res.error) console.error(`Error loading fences from server due to: ${res.error}`);
            if (callback && typeof(callback) == "function") callback(res.data);
            return res.data;
        })
}

/**
 * Update fence on server
 * @param {str} id Id or name of the fence
 * @param {object} fence Fence data in format: { name: "some_name", id: "source id", "bbox": [x1,y1,x2,y2] } 
 * @param {function} callback Function to execute when a response is received. 
 */
const serverUpdateFence = (id, fence, callback) => {
    fetch("/fences/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: id, data: fence })
        })
        .then(req => req.json())
        .then(res => {
            if (res.error) return alert(`Failed to save fence due to: ${res.error}`);
            if (callback && typeof(callback) == "function") callback(res);
            return res;
        })
}

/**
 * Remove fence on server
 * @param {str} id Id or name of the fence
 * @param {function} callback Function to execute when a response is received. 
 */
const serverRemoveFence = (id, callback) => {
    fetch("/fences/remove", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: id })
        })
        .then(req => req.json())
        .then(res => {
            if (res.error) return alert(error);
            if (callback && typeof(callback) == "function") callback(res);
            return res;
        })
}




/******************************************************************************************** *
 * ********************************** ALERTS STUFF ****************************************** *
 * *******************************************************************************************/

/**
 * Load alerts from server
 * @param {function} callback Function to execute when a response is received. 
 */
const serverLoadAlerts = (callback) => {
    fetch("/alerts/load")
        .then(req => req.json())
        .then(res => {
            if (res.error) console.error(`Error loading alerts from server due to: ${res.error}`);
            if (callback && typeof(callback) == "function") callback(res.data);
            return res.data;
        })
}

/**
 * Update alert on server
 * @param {str} id Id or name of the alert
 * @param {object} alert Alert data in format: { name: "some_name", id: "source id", "bbox": [x1,y1,x2,y2] } 
 * @param {function} callback Function to execute when a response is received. 
 */
const serverUpdateAlert = (id, alert, callback) => {
    fetch("/alerts/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: id, data: alert })
        })
        .then(req => req.json())
        .then(res => {
            if (res.error) return alert(`Failed to save alert due to: ${res.error}`);
            if (callback && typeof(callback) == "function") callback(res);
            return res;
        })
}

/**
 * Remove alert on server
 * @param {str} id Id or name of the alert
 * @param {function} callback Function to execute when a response is received. 
 */
const serverRemoveAlert = (id, callback) => {
    fetch("/alerts/remove", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: id })
        })
        .then(req => req.json())
        .then(res => {
            if (res.error) return alert(error);
            if (callback && typeof(callback) == "function") callback(res);
            return res;
        })
}



export {
    serverLoadFences,
    serverUpdateFence,
    serverRemoveFence,
    serverLoadAlerts,
    serverUpdateAlert,
    serverRemoveAlert,
    sendViaGmail,
    sendViaTelegram
}