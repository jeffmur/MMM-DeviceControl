/* Magic Mirror
 * Module: MMM-DeviceControl
 *
 * By {{AUTHOR_NAME}}
 * {{LICENSE}} Licensed.
 */

Module.register("MMM-DeviceControl", {
  defaults: {
    updateInterval: 1000 // every second
    // retryDelay: 5000
  },

  requiresVersion: "2.1.0", // Required version of MagicMirror

  start: function () {
    var self = this;

    console.log("[MMM-DeviceControl] Initalized");
    this.activate();
  },

  /**
   * Starting Daemons
   */
  activate: function () {
    this.sendSocketNotification("START", config.updateInterval);
  },

  // notification from other modules
  notificationReceived: function (notification, payload, sender) {
    if (sender === undefined) return;
    // Pass all to node_helper.js
    // Google Assistant will control user intents
    // Profile Switcher will wake when user is detected
    if (
      sender.name === "MMM-GoogleAssistant" ||
      sender.name === "MMM-ProfileSwitcher"
    ) {
      this.sendSocketNotification(notification, payload);
    }
  },

  /**
   * From node_helper.js
   * @param {*} notification
   * @param {*} payload
   */
  socketNotificationReceived: function (notification, payload) {
    if (notification === "GetVolume") {
      this.sendNotification(notification, payload);
    }
  }
});
