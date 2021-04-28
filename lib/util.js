'use strict';

const dgram = require('dgram');
const advertisements = dgram.createSocket('udp4');
var new_devices = {};
var added_devices = {};

class Util {

  constructor(opts) {
    this.homey = opts.homey;
  }

  /* get all previously paired yeelights for matching broadcast messages */
  async fillAddedDevices() {
    try {
      let devices = await this.homey.drivers.getDriver('yeelight').getDevices();
      Object.keys(devices).forEach((key) => {
        added_devices[devices[key].getData().id] = devices[key];
      });
      return Promise.resolve(added_devices);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /* send discovery message during pair wizard */
  discover() {
    try {
      return new Promise(resolve => {
        var message = 'M-SEARCH * HTTP/1.1\r\nMAN: \"ssdp:discover\"\r\nST: wifi_bulb\r\n';
        var broadcast = () => advertisements.send(message, 0, message.length, 1982, "239.255.255.250");
        var broadcastInterval = setInterval(broadcast, 5000);
        broadcast();

        setTimeout(() => {
          clearInterval(broadcastInterval);
          resolve(new_devices);
        }, 6000);
    	});
    } catch (error) {
      console.log(error);
    }
  }

  /* listen for advertisements which are send during pairing, when Yeelights come online or at a regular interval from online Yeelights */
  async listenUpdates() {
    try {
      let localAddress = await this.homey.cloud.getLocalAddress();
      advertisements.bind(1982, () => {
        if (advertisements) {
          advertisements.addMembership('239.255.255.250');
          advertisements.setBroadcast(true);
          advertisements.setMulticastTTL(255);
          advertisements.setMulticastInterface(localAddress.slice(0, -3));
        }
      });
    } catch(error) {
      console.log(error);
    }

    advertisements.on('message', (message, address) => {
      process.nextTick(() => {
        this.parseMessage(message)
          .then(result => {
            if (result !== 'no devices') { // there are new devices for pairing
              if (result.message_type === 'discover' && !new_devices.hasOwnProperty(result.device.id) && !added_devices.hasOwnProperty(result.device.id)) {
                new_devices[result.device.id] = result.device;
              }

              Object.keys(added_devices).forEach((key) => {
                // update address setting for Yeelights with changed ip's
                if (result.message_type !== 'discover' && added_devices[key].getData().id == result.device.id && (added_devices[key].getSetting('address') != result.device.address || added_devices[key].getSetting('port') != result.device.port) ) {
                  added_devices[key].setSettings({address: result.device.address, port: result.device.port});
                }
                // new sockets for broken devices
                if (result.message_type != 'discover' && added_devices[key].getData().id == result.device.id && !added_devices[key].isConnected(result.device.id)) {
                  added_devices[key].createDeviceSocket();
                }
              });
            }
          })
          .catch(error => {
            console.error(error);
          })
      });
    });

    advertisements.on('error', (error) => {
      console.error(error);
    });
  }

  /* parse incoming broadcast messages */
  parseMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        var headers = message.toString();
        var re = /: /gi;
        var re2 = /\r\n/gi;

        if (headers.includes('NOTIFY')) {
          var message_type = 'notification';
        } else {
          var message_type = 'discover';
        }

        if (!headers.includes('ssdp:discover')) {
          headers = headers.split("\r\nLocation:").pop();
          headers = headers.substring(0, headers.indexOf("\r\nname:"));
          headers = 'Location:'+ headers+'';
          headers = headers.replace(re, '": "');
          headers = headers.replace(re2, '",\r\n"');
          headers = '{ "'+ headers +'" }';

          var result = JSON.parse(headers);

          var location = result.Location.split(':');
          var address = location[1].replace('//', '');
          var port = parseInt(location[2], 10);

          if (result.power == 'on') {
            var onoff = true;
          } else {
            var onoff = false;
          }

          var device = {
            id: result.id,
            address: address,
            port: port,
            model: result.model,
            onoff: onoff,
            dim: parseInt(result.bright),
            mode: parseInt(result.color_mode),
            temperature: parseInt(result.ct),
            rgb: parseInt(result.rgb),
            hue: parseInt(result.hue),
            saturation: parseInt(result.sat)
          }

          return resolve({
            message_type: message_type,
            device: device
          });
        } else {
          return resolve('no devices');
        }
      } catch (error) {
        return reject(error);
      }
    })
  }

  normalize(value, min, max) {
  	var normalized = (value - min) / (max - min);
  	return Number(normalized.toFixed(2));
  }

  denormalize(normalized, min, max) {
  	var denormalized = ((1 - normalized) * (max - min) + min);
  	return Number(denormalized.toFixed(0));
  }

}

module.exports = Util;
