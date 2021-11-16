/**
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
"use strict";

// [START imports]
const firebase = require("firebase-admin");
const { exec } = require("child_process");
// [END imports]

// TODO(DEVELOPER): Change the two placeholders below.
// [START initialize]
// Initialize the app with a service account, granting admin privileges
/** @type {any} */
const serviceAccount = require("/home/pi/MagicMirror/modules/MMM-DeviceControl/service-account.json");
firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: "https://smartmirror-fba08-default-rtdb.firebaseio.com"
});
const dataRoot = "/mirror/";
// [END initialize]

/**
 * Send a new star notification email to the user with the given UID.
 *
 * @param child
 * @param attribute
 */
// [START get_status]
function _get_status(child, attribute) {
  // Fetch the current status of washer
  const userRef = firebase.database().ref(dataRoot);
  return userRef
    .once("value")
    .then(async function (snapshot) {
      return await snapshot.val()[child][attribute];
    })
    .catch(function (error) {
      console.log("Failed to read from Firebase:", error);
    });
}
// [END get_status]

const get_sensor_status = (attribute) => {
  let child = "";
  switch (attribute) {
    case "mute":
    case "volumeLevel":
      child = "Volume";
      break;
    case "on":
      child = "OnOff";
      break;
    // case "dummy":
    //   child = "RunCycle"
    //   break;
    // default:
    //   child = "OnOff"
    //   break;
  }
  return sleep(1000).then((v) => _get_status(child, attribute));
};

/**
 *
 * @param {*} attribute
 * @param {*} key
 * @param {*} val
 */
function set_status(attribute, key, val) {
  const ref = firebase.database().ref(dataRoot);
  const attrs = ref.child(attribute);
  attrs.child(key).set(val, (error) => {
    if (error) {
      console.log("Data could not be saved." + error);
      process.exit(0);
    } else {
      console.log("Data saved successfully.");
      process.exit(0);
    }
  });
}

/**
 * RESTful interface
 * Screen State: OnOff.on
 * Only READS current status and updates
 *
 * @param interval
 */
function display_daemon(interval) {
  /**
   * true: turn on display
   * false: turn off display
   */
  get_sensor_status("on").then((status) => {
    const cmd = "xrandr -display :0 --output HDMI-1 ";
    if (status === true) {
      exec(cmd + "--mode 1920x1080");
    } else {
      exec(cmd + "--off");
    }

    setTimeout(function () {
      console.log("[Mirror] Monitor is On: " + status);
      display_daemon(interval);
    }, interval);
  });
}

/**
 * RESTful interface
 * Screen State: OnOff.on
 * Only READS current status and updates
 *
 * @param interval
 */
function volume_daemon(interval) {
  /**
   * :type int: interval time in milliseconds to read realtime database
   * Expects status to be int between 1-100
   */
  get_sensor_status("volumeLevel").then((status) => {
    const cmd = "amixer sset 'Master' ";
    if (status <= 10) {
      status = status * 10;
    } // testing TODO A REAL FIX
    exec(cmd + status + "%");
    setTimeout(function () {
      console.log("[Mirror] Monitor Volume is: " + status);
      volume_daemon(interval);
    }, interval);
  });
}

/**
 * @param interval
 */
function mute_daemon(interval) {
  /**
   * :type int: interval time in milliseconds to read realtime database
   * Expects status to be int between 1-100
   */
  get_sensor_status("mute").then((status) => {
    const cmd = "amixer sset 'Master' ";
    if (status === true) {
      exec(cmd + "mute");
    } else {
      exec(cmd + "unmute");
    }
    setTimeout(function () {
      console.log("[Mirror] Monitor is Mute: " + status);
      mute_daemon(interval);
    }, interval);
  });
}

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// display_daemon(1000);
// volume_daemon(1000);
// mute_daemon(1000);

// set_status("volumeLevel", 10);

// module.exports = { get_sensor_status, set_status, sleep };
