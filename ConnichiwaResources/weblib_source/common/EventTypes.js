/**
 * This event is a global, internal synonym for the {@link
 *    Connichiwa.event:onLoad} event
 * @event ready 
 */

/**
 * This event is fired after Connichiwa was loaded and set up properly. You
 *    can attach an event handler to this event by using the {@link
 *    Connichiwa.onLoad} method.
 *
 * On remotes, onLoad will further ensure that every script added to {@link
 *    Connichiwa.autoLoad} is loaded, so your code can rely on variables and
 *    methods created in these scripts.
 * @event onLoad
 * @memberOf  Connichiwa
 */

/**
 * This event is fired when an acknowledgment for receiving a message is
 *    received. Such an acknowledgment can be sent using {@link
 *    Connichiwa._sendAck}. The `{ID}` in the event name is replaced with the
 *    ID of the message that was acknowledged. This way, a callback function
 *    can be registered for the acknowledgement of a specific message using
 *    {@link CWEventManager.on}
 * @event __ack_message{ID}
 * @param {Object} message TODO
 * @protected
 */

/**
 * This event is fired when a swipe was detected on this device that could
 * be part of a stitch
 * @event stitchswipe
 * @param {Object} message TODO
 * @protected
 */

/**
 * This event is fired when this device was stitched to another device. This
 *    means the device's relative location changed, which can be retrieved
 *    using {@link CWStitchManager.getLocalDeviceTransformation}
 * @event wasStitched
 * @param {Object} message TODO
 */

/**
 * This event is fired when this device was unstitched. The device's relative
 *    position is now unknown and {@link
 *    CWStitchManager.getLocalDeviceTransformation} will return default values
 * @event wasUnstitched
 * @param {Object} message TODO
 */

/**
 * This event is fired when this device was used by another device to
 *    determine the other device's relative position (which means the other
 *    device is places next to this device)
 * @event gotstitchneighbor
 * @param {Object} message TODO
 */

/**
 * This event is fired at a regular interval (usually every ~500ms) and
 *    contains the latest gyroscope data from the device. If the device does
 *    not feature a gyroscope, this event is never fired.
 * @event gyroscopeUpdate
 * @param {CWGyroscope.GyroscopeData} data The latest gyroscope data
 */

/**
 * This event is fired at a regular interval (usually every ~500ms) and
 *    contains the latest accelerometer data from the device. If the device
 *    does not feature an accelerometer, this event is never fired.
 * @event accelerometerUpdate
 * @param {CWGyroscope.AccelerometerData} data The latest accelerometer data
 */

/**
 * This event is fired when the proximity sensor of the device reports that
 *    its state changed
 * @event proximityStateChanged
 * @param {Bool} proximityState The new proximity state - `true` if something
 *    is in front of the proximity sensor of the device, otherwise `false`
 */

/**
 * This event is fired when a new device is detected over Bluetooth
 * @event devicedetected
 * @param {CWDevice} device The detected device
 */

/**
 * This event is fired when the approximated distance between the master and a
 *    detected device changes. If multiple devices are nearby, this method is
 *    called for each device seperately
 * @event devicedistancechanged
 * @param {CWDevice} device The device whose distance was changed
 */

/**
 * This event is fired whenever a previously detected device is lost (for
 *    example because it is switched off, closes the app or goes out of
 *    Bluetooth-range)
 * @event devicelost
 * @param {CWDevice} device The lost device
 */

/**
 * This event is fired whenever a device connects to the master's server,
 *    either as the result of a call to {@link CWDevice#connect} or becuase it
 *    manually connected (e.g. through a webbrowser)
 * @event deviceconnected
 * @param {CWDevice} device The connected device
 */

/**
 * This event is fired whenever the connection attempt to a detected but
 *    unconnected device failed. Such an attempt can fail, for example, if the
 *    two devices do not share a common network and are unable to connect over
 *    an ad hoc network. This is the opposing event to {@link
 *    event:remoteconnected}
 * @event connectfailed
 * @param {CWDevice} device The device that could not be connected
 */

/**
 * This event is fired when a previously connected remote device has
 *    disconnected. A disconnect can happen for example because the app was
 *    closed, the device was switched off, the device connected to another
 *    device but also because of network failures. A disconnected device can
 *    still be discovered if it remains in Bluetooth-range, in which case it
 *    will continue to send events such as {@link event:devicedistancechanged}
 * @event devicedisconnected
 * @param {CWDevice} device The device that disconnected
 */

/**
 * This event is fired whenever the datastore on the local device changed. For
 *    example, this is the result of {@link CWDatastore.set} or {@link
 *    CWDatastore.setMultiple}. Note that for {@link CWDatastore.setMultiple},
 *    only a single event with a collection of changes is triggered.
 * @event _datastorechanged
 * @param {String} collection The collection that changed, or `undefined` if
 *    the default collection has changed
 * @param {Object} changes Key-value pairs, each representing a change to the
 *    reported collection. The key is of each entry is the key in the
 *    collection that changed, and the value is the new value stored for that
 *    key
 * @protected
 */
