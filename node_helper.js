/* Magic Mirror
 * Node Helper: MMM-DeviceControl
 *
 * By Jeffrey Murray Jr
 * Smart TV Device for Google Assistant
 * Requirements:
 * see package.json
 * service-account.json
 * LINK TO CODELAB?
 */

// [START imports]
const firebase = require("firebase-admin");
const { exec } = require("child_process");
var NodeHelper = require("node_helper");
var savedState = undefined;
var display_is_activate = true;
// Important, always have mirror on when starting Magic Mirror
// [END imports]

module.exports = NodeHelper.create({
  start: function () {
    // TODO(DEVELOPER): Change the two placeholders below.
    // [START initialize]
    // Initialize the app with a service account, granting admin privileges
    /** @type {any} */
    const serviceAccount = require("../service-account.json");
    firebase.initializeApp({
      credential: firebase.credential.cert(serviceAccount),
      databaseURL: "WEBHOOK OF FIREBASE URL"
    });
    this.dataRoot = "/mirror/"; // name of device
    savedState = this;
    // [END initialize]
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "START") {
      // initalize daemons
      // payload MUST contain time in milliseconds
      this.display_daemon(payload);
      this.volume_daemon(payload);
      this.mute_daemon(payload);
    } else if (notification === "SetRelativeVolume") {
      // increase volume by scale factor
      savedState.set_status("mute", false);
      savedState.set_status("volumeLevel", payload);
    } else if (notification === "SetVolume") {
      var newVol = payload.volumeLevel;
      if (payload.volumeLevel === 0) {
        savedState.set_status("mute", true);
      } else if (payload.isPercentage) {
        // if muted unmute
        savedState.set_status("mute", false);
        savedState.set_status("volumeLevel", newVol);
      } else {
        // volumeLevel == (-10 <-> 10)
        this.get_sensor_status("volumeLevel", payload).then((current) => {
          var scaledVol = Math.trunc(newVol * 10) += current;
          savedState.set_status("volumeLevel", scaledVol);
        });
      }
      // GET VOLUME
    } else if (notification === "GetVolume") {
      this.get_sensor_status("volumeLevel", payload).then((current) => {
        // console.log("[Assistant Node] Volume is " + current);
        this.sendSocketNotification("GetVolume", current);
      });
    }
    else if (notification === "WAKEUP") {
      this.set_status("on", true); // update firebase status
      exec("xscreensaver-command -deactivate"); // mirror will turn on every time user is detected
    }
  },

  /**
   * PRIVATE Method
   *
   * @param {string} child
   * @param {string} attribute
   * @returns Value in Firebase Realtime Database at Child.Attribute
   */
  _get_status: function (child, attribute) {
    // Fetch the current status of washer
    const userRef = firebase.database().ref(this.dataRoot);
    return userRef
      .once("value")
      .then(async function (snapshot) {
        return await snapshot.val()[child][attribute];
      })
      .catch(function (error) {
        console.log("Failed to read from Firebase:", error);
      });
  },

  /**
   * Promise Execution after sleep
   *
   * @param {integer} ms
   * @returns Promise<Object> to execute in ms time
   */
  sleep: function (ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  mapSensor: function (attribute) {
    switch (attribute) {
      case "isMuted":
      case "mute":
      case "volumeLevel":
        return "Volume";
      case "on":
        return "OnOff";
    }
  },

  /**
   * PUBLIC Method
   * Mapping of child nodes to attributes (variables)
   *
   * @param {string} attribute
   * @param delay
   * @returns Status
   */
  get_sensor_status: function (attribute, delay) {
    let child = this.mapSensor(attribute);
    return this.sleep(delay).then((v) => this._get_status(child, attribute));
  },

  /**
   * Public Asynchronous Method
   *
   * @param {*} key
   * @param {*} val
   * @param delay
   */
  set_status: function (key, val) {
    const ref = firebase.database().ref(this.dataRoot);
    const attrs = ref.child(this.mapSensor(key));
    attrs.child(key).set(val, (error) => {
      if (error) {
        console.log("Data could not be saved." + error);
      } else {
        console.log("Data saved successfully.");
      }
    });
  },

  // ************** DAEMONS ***************
  // Read Firebase dataset and compare to state
  // Execute commands on Raspberry Pi 4

  /**
   * PUBLIC Method
   * Turns Raspberry Pi Screen Off/On
   *
   * @param {integer} interval in milliseconds
   */
  display_daemon: function (interval) {
    // sleep then execute
    this.get_sensor_status("on", interval).then((status) => {
      const cmd = "xscreensaver-command ";
      if (status !== display_is_activate) {
        display_is_activate = status; // update status
        if (status === true) {
          exec(cmd + "-deactivate"); // disable screensaver
          display_is_activate = status;
        } else {
          exec(cmd + "-activate"); // enable screensaver
        }
      }

      setTimeout(function () {
        savedState.display_daemon(interval);
      }, interval);
    });
  },

  /**
   * PUBLIC Method
   * Changes Volume Level
   * Note: O-10 is a scale (TODO)
   *
   * @param {integer} interval in milliseconds
   */
  volume_daemon: function (interval) {
    // sleep then execute
    savedState.get_sensor_status("volumeLevel", interval).then((status) => {
      const cmd = "amixer sset 'Master' ";
      if (status < 10) {
        status = status * 10;
      } // "Hey Google, set mirror volume to 2"
      exec(cmd + status + "%");
      setTimeout(function () {
        // console.log("[Mirror] Monitor Volume is: " + status);
        savedState.volume_daemon(interval);
      }, interval);
    });
  },

  /**
   * PUBLIC Method
   * Mute/Unmute Speaker
   *
   * @param {integer} interval in milliseconds
   */
  mute_daemon: function (interval) {
    // sleep then execute
    savedState.get_sensor_status("isMuted", interval).then((status) => {
      const cmd = "amixer sset 'Master' ";
      if (status === true) {
        exec(cmd + "mute");
      } else {
        exec(cmd + "unmute");
      }
      setTimeout(function () {
        // console.log("[Mirror] Monitor is Mute: " + status);
        savedState.mute_daemon(interval);
      }, interval);
    });
  }
});
