'use strict';

const Homey = require('homey');
const net = require('net');
const tinycolor = require("tinycolor2");
const Util = require('../../lib/util.js');

class YeelightDevice extends Homey.Device {

  async onInit() {
    if (!this.util) this.util = new Util({homey: this.homey});

    /* update the paired devices list when a device is initialized */
    this.homey.setTimeout(async () => { await this.util.fillAddedDevices(); }, 2000);

    this.data = this.getData();
    this.socket = null;
    this.reconnect = null;
    this.connecting = false;
    this.connected = false;

    await this.setAvailable();
    this.createDeviceSocket();

    // LISTENERS FOR UPDATING CAPABILITIES
    this.registerCapabilityListener('onoff', async (value) => {
      const action = value ? 'on' : 'off';
      return await this.sendCommand(this.getData().id, '{"id": 1, "method": "set_power", "params":["'+ action +'", "smooth", 500]}');
    });

    this.registerCapabilityListener('onoff.bg', async (value) => {
      const action = value ? 'on' : 'off';
      return await this.sendCommand(this.getData().id, '{"id": 1, "method": "bg_set_power", "params":["'+ action +'", "smooth", 500]}');
    });

    this.registerCapabilityListener('dim', async (value, opts) => {
      try {
        let brightness = value === 0 ? 1 : value * 100;
        // Logic which will toggle between night_mode and normal_mode when brightness is set to 0 or 100 two times within 5 seconds
        if (this.hasCapability('night_mode') && opts.duration === undefined) {
          if (value === 0) {
            if (this.dimMinTime + 5000 > Date.now()) {
              await this.triggerCapabilityListener('night_mode', true);
              if (this.getCapabilityValue('night_mode') === false) {
                brightness = 100;
              }
              this.dimMinTime = 0;
            } else {
              this.dimMinTime = Date.now();
            }
          } else if (value === 1) {
            if (this.dimMaxTime + 5000 > Date.now()) {
              await this.triggerCapabilityListener('night_mode', false);
              if (this.getCapabilityValue('night_mode') === true) {
                brightness = 1;
              }
              this.dimMaxTime = 0;
            } else {
              this.dimMaxTime = Date.now();
            }
          } else {
            this.dimMinTime = 0;
            this.dimMaxTime = 0;
          }
        }

        if (opts.duration === undefined || typeof opts.duration == 'undefined') {
          opts.duration = '500';
        }

        if (value === 0 && !this.hasCapability('night_mode')) {
          return await this.sendCommand(this.getData().id, '{"id": 1, "method": "set_power", "params":["off", "smooth", 500]}');
        } else if (value === 0) {
          if (this.getData().model === 'color') {
            var color_temp = this.util.denormalize(this.getCapabilityValue('light_temperature'), 1700, 6500);
          } else if (this.getData().model === 'lamp') {
            var color_temp = this.util.denormalize(this.getCapabilityValue('light_temperature'), 2600, 5000);
          } else {
            var color_temp = this.util.denormalize(this.getCapabilityValue('light_temperature'), 2700, 6500);
          }
          return await this.sendCommand(this.getData().id, '{"id":1,"method":"start_cf","params":[1, 2, "'+ opts.duration +', 2, '+ color_temp +', 0"]}');
        } else {
          return await this.sendCommand(this.getData().id, '{"id":1,"method":"set_bright","params":['+ brightness +', "smooth", '+ opts.duration +']}');
        }
      } catch (error) {
        return Promise.reject(error);
      }
    });

    this.registerCapabilityListener('dim.bg', async (value, opts) => {
      try {
        if (opts.duration === undefined || typeof opts.duration == 'undefined') {
          opts.duration = '500';
        }
        let brightness = value === 0 ? 1 : value * 100;
        return await this.sendCommand(this.getData().id, '{"id":1,"method":"bg_set_bright","params":['+ brightness +', "smooth", '+ opts.duration +']}');
      } catch (error) {
        return Promise.reject(error);
      }
    });

    this.registerCapabilityListener('night_mode', async (value) => {
      const action = value ? '5' : '1';
      return await this.sendCommand(this.getData().id, '{"id": 1, "method": "set_power", "params":["on", "smooth", 500, '+ action +']}');
    });

    this.registerMultipleCapabilityListener(['light_hue', 'light_saturation' ], async ( valueObj, optsObj ) => {
      try {
        if (!this.getCapabilityValue('onoff')) {
          this.setCapabilityValue('onoff', true);
        }

        if (typeof valueObj.light_hue !== 'undefined') {
          var hue = Math.round(valueObj.light_hue * 359);
        } else {
          var hue = await this.getCapabilityValue('light_hue') * 359;
        }

        if (typeof valueObj.light_saturation !== 'undefined') {
          var saturation = Math.round(valueObj.light_saturation * 100);
        } else {
          var saturation = await this.getCapabilityValue('light_saturation') * 100;
        }

        if (this.getData().model === 'ceiling4' || this.getData().model === 'ceiling10' || this.getData().model === 'ceiling20') {
          return await this.sendCommand(this.getData().id, '{"id":1,"method":"bg_set_hsv","params":['+ hue +','+ saturation +', "smooth", 500]}');
        } else {
          return await this.sendCommand(this.getData().id, '{"id":1,"method":"set_hsv","params":['+ hue +','+ saturation +', "smooth", 500]}');
        }
      } catch (error) {
        return Promise.reject(error);
      }
    }, 500);

    this.registerCapabilityListener('light_temperature', async (value) => {
      try {
        if (!this.getCapabilityValue('onoff')) {
          this.triggerCapabilityListener('onoff', true);
        }

        if (this.getData().model === 'color') {
          var color_temp = this.util.denormalize(value, 1700, 6500);
        } else if (this.getData().model === 'lamp') {
          var color_temp = this.util.denormalize(value, 2600, 5000);
        } else {
          var color_temp = this.util.denormalize(value, 2700, 6500);
        }
        if (this.hasCapability('night_mode')) {
          this.setCapabilityValue('night_mode', false);
        }
        return await this.sendCommand(this.getData().id, '{"id":1,"method":"set_ct_abx","params":['+ color_temp +', "smooth", 500]}');
      } catch (error) {
        return Promise.reject(error);
      }
    });

    this.registerCapabilityListener('light_temperature.bg', async (value) => {
      try {
        if (!this.getCapabilityValue('onoff.bg')) {
          this.setCapabilityValue('onoff.bg', true);
        }
        const color_temp = this.util.denormalize(value, 2700, 6500);
        return await this.sendCommand(this.getData().id, '{"id":1,"method":"bg_set_ct_abx","params":['+ color_temp +', "smooth", 500]}');
      } catch (error) {
        return Promise.reject(error);
      }
    });

    this.registerCapabilityListener('light_mode', async (value) => {
      return Promise.resolve(true);
    });

  }

  async onDeleted() {
    try {
      this.homey.clearTimeout(this.reconnect);
      if (this.socket) {
        this.socket.destroy();
      }
    } catch (error) {
      this.error(error);
    }
  }

  async onUninit() {
    try {
      this.homey.clearTimeout(this.reconnect);
      if (this.socket) {
        this.socket.destroy();
      }
    } catch (error) {
      this.error(error);
    }
  }

  // HELPER FUNCTIONS

  /* establish socket with online devices and update state upon connect */
  createDeviceSocket() {
    try {
      if (this.socket === null && this.connecting === false && this.connected === false) {
        this.connecting = true;
        this.socket = new net.Socket();
        this.socket.connect(this.getSetting('port'), this.getSetting('address'), () => {
          this.socket.setKeepAlive(true, 5000);
          this.socket.setTimeout(0);
        });
      } else {
        this.log("Yeelight - trying to create socket, but connection not cleaned up previously.");
      }
    } catch (error) {
  		this.log("Yeelight - error creating socket: " + error);
  	}

    this.socket.on('connect', async () => {
      this.connecting = false;
      this.connected = true;

      if (!this.getAvailable()) { await this.setAvailable(); }

      /* get current light status 4 seconds after connection */
      this.homey.setTimeout(() => {
        if (this.socket !== null) {
          this.socket.write('{"id":1,"method":"get_prop","params":["power", "bright", "color_mode", "ct", "rgb", "hue", "sat"]}' + '\r\n');
        }
      }, 4000);
    });

    this.socket.on('error', (error) => {
      this.log("Yeelight - socket error: "+ error);
      this.connected = false;

      if (this.socket) {
        this.socket.destroy();
      }

      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error == 'Error: Error sending command') {
        this.log("Yeelight - trying to reconnect in 6 seconds.");
        var time2retry = 6000;
      } else {
        this.log("Yeelight - trying to reconnect in 60 seconds.");
        var time2retry = 60000;
      }

      if (this.reconnect === null) {
        this.reconnect = this.homey.setTimeout(() => {
          if (typeof this.connecting !== "undefined" && typeof this.connected !== "undefined") {
            if (this.connecting === false && this.connected === false) {
              this.createDeviceSocket();
            }
          }
          this.reconnect = null;
        }, time2retry);
      }
    });

    this.socket.on('close', async (had_error) => {
      try {
        this.connecting = false;
        this.connected = false;
        this.socket = null;
        await this.setUnavailable(this.homey.__('device.unreachable'));
      } catch (error) {
        this.error(error);
      }
    });

    this.socket.on('data', async (message, address) => {
      try {
        this.homey.clearTimeout(this.reconnect);
        this.reconnect = null;

        if(!this.getAvailable()) { await this.setAvailable(); }

        var parsed_message = message.toString().replace(/{"id":1, "result":\["ok"\]}/g, '').replace(/{"id":1,"result":\["ok"\]}/g, '').replace(/\r\n/g,'');

        if (parsed_message.includes('props')) {
          try {
            var result = JSON.parse(parsed_message);

            for (const key in result.params) {
              switch (key) {
                case 'power':
                  let onoff = result.params.power === 'on' ? true : false;
                  if (this.getCapabilityValue('onoff') !== onoff) {
                    this.setCapabilityValue('onoff', onoff);
                  }
                  break;
                case 'main_power':
                  let main_power = result.params.main_power === 'on' ? true : false;
                  if (this.getCapabilityValue('onoff') !== main_power) {
                    this.setCapabilityValue('onoff', main_power);
                  }
                  break;
                case 'bg_power':
                  if (this.hasCapability('onoff.bg')) {
                    let bg_power = result.params.bg_power === 'on' ? true : false;
                    if (this.getCapabilityValue('onoff.bg') !== bg_power) {
                      this.setCapabilityValue('onoff.bg', bg_power);
                    }
                  }
                  break;
                case 'bright':
                  var dim = result.params.bright / 100;
                  if (this.getCapabilityValue('dim') !== dim) {
                    this.setCapabilityValue('dim', dim);
                  }
                  break;
                case 'active_bright':
                  var active_dim = result.params.active_bright / 100;
                  if (this.getCapabilityValue('dim') !== active_dim) {
                    this.setCapabilityValue('dim', active_dim);
                  }
                  break;
                case 'bg_bright':
                  if (this.hasCapability('dim.bg')) {
                    var dim_bg = result.params.bg_bright / 100;
                    if (this.getCapabilityValue('dim.bg') !== dim_bg) {
                      this.setCapabilityValue('dim.bg', dim_bg);
                    }
                  }
                  break;
                case 'ct':
                  if (this.getData().model === 'color' || this.getData().model === 'colorc') {
                    var color_temp = this.util.clamp(1 - this.util.normalize(result.params.ct, 1700, 6500), 0, 1);
                  } else if (this.getData().model === 'lamp') {
                    var color_temp = this.util.clamp(1 - this.util.normalize(result.params.ct, 2600, 5000), 0, 1);
                  } else {
                    var color_temp = this.util.clamp(1 - this.util.normalize(result.params.ct, 2700, 6500), 0, 1);
                  }
                  if (this.hasCapability('light_temperature')) {
                    if (this.getCapabilityValue('light_temperature') !== this.util.clamp(color_temp, 0, 1)) {
                      this.setCapabilityValue('light_temperature', this.util.clamp(color_temp, 0, 1));
                    }
                  }
                  break;
                case 'bg_ct':
                  var color_temp = this.util.clamp(1 - this.util.normalize(result.params.ct, 2700, 6500), 0, 1);
                  if (this.hasCapability('light_temperature.bg')) {
                    if (this.getCapabilityValue('light_temperature.bg') !== this.util.clamp(color_temp, 0, 1)) {
                      this.setCapabilityValue('light_temperature.bg', this.util.clamp(color_temp, 0, 1));
                    }
                  }
                  break;
                case 'rgb':
                  var color = tinycolor(result.params.rgb.toString(16));
                  var hsv = color.toHsv();
                  var hue = Number((hsv.h / 359).toFixed(2));
                  var saturation = Number(hsv.s.toFixed(2));
                  if (this.hasCapability('light_hue') && this.hasCapability('light_saturation')) {
                    if (this.getCapabilityValue('light_hue') !== this.util.clamp(hue, 0, 1)) {
                      this.setCapabilityValue('light_hue', this.util.clamp(hue, 0, 1));
                    }
                    if (this.getCapabilityValue('light_saturation') !== saturation) {
                      this.setCapabilityValue('light_saturation', saturation);
                    }
                  }
                  break;
                case 'bg_rgb':
                  var rgb_color = tinycolor(result.params.bg_rgb.toString(16));
                  var rgb_hsv = rgb_color.toHsv();
                  var rgb_hue = Number((rgb_hsv.h / 359).toFixed(2));
                  var rgb_saturation = Number(rgb_hsv.s.toFixed(2));
                  if (this.hasCapability('light_hue') && this.hasCapability('light_saturation')) {
                    if (this.getCapabilityValue('light_hue') !== this.util.clamp(rgb_hue, 0, 1)) {
                      this.setCapabilityValue('light_hue', this.util.clamp(rgb_hue, 0, 1));
                    }
                    if (this.getCapabilityValue('light_saturation') !== rgb_saturation) {
                      this.setCapabilityValue('light_saturation', rgb_saturation);
                    }
                  }
                  break;
                case 'hue':
                  var hue = result.params.hue / 359;
                  if (this.hasCapability('light_hue')) {
                    if (this.getCapabilityValue('light_hue') !== this.util.clamp(hue, 0, 1)) {
                      this.setCapabilityValue('light_hue', this.util.clamp(hue, 0, 1));
                    }
                  }
                  break;
                case 'bg_hue':
                  var bg_hue = result.params.bg_hue / 359;
                  if (this.hasCapability('light_hue')) {
                    if (this.getCapabilityValue('light_hue') !== this.util.clamp(bg_hue, 0, 1)) {
                      this.setCapabilityValue('light_hue', this.util.clamp(bg_hue, 0, 1));
                    }
                  }
                  break;
                case 'sat':
                  var saturation = result.params.sat / 100;
                  if (this.hasCapability('light_saturation')) {
                    if (this.getCapabilityValue('light_saturation') !== saturation) {
                      this.setCapabilityValue('light_saturation', saturation);
                    }
                  }
                  break;
                case 'bg_sat':
                  var bg_saturation = result.params.bg_sat / 100;
                  if (this.hasCapability('light_saturation')) {
                    if (this.getCapabilityValue('light_saturation') !== bg_saturation) {
                      this.setCapabilityValue('light_saturation', bg_saturation);
                    }
                  }
                  break;
                case 'color_mode':
                  if (this.hasCapability('light_mode')) {
                    if (result.params.color_mode === 2) {
                      this.setCapabilityValue('light_mode', 'temperature');
                    } else {
                      this.setCapabilityValue('light_mode', 'color');
                    }
                  }
                  break;
                case 'bg_lmode':
                  if (this.hasCapability('light_mode.bg')) {
                    if (result.params.bg_lmode === 2) {
                      this.setCapabilityValue('light_mode.bg', 'temperature');
                    } else {
                      this.setCapabilityValue('light_mode.bg', 'color');
                    }
                  }
                  break;
                case 'nl_br':
                  if (result.params.nl_br !== 0) {
                    var dim = result.params.nl_br / 100;
                    if (this.getCapabilityValue('dim') !== dim) {
                      this.setCapabilityValue('dim', dim);
                    }
                  }
                  if (this.hasCapability('night_mode')) {
                    if (result.params.active_mode == 0 && this.getCapabilityValue('night_mode') === true) {
                      this.setCapabilityValue('night_mode', false);
                    } else if (result.params.active_mode !== 0 && this.getCapabilityValue('night_mode') === false) {
                      this.setCapabilityValue('night_mode', true);
                    }
                  }
                  break;
                default:
                  break;
              }
            }

          } catch (error) {
            this.log('Unable to process message because of error: '+ error);
          }
        } else if (parsed_message.includes('result')) {
          try {
            var result = JSON.parse(parsed_message);

            if (result.result[0] != "ok") {
              var dim = result.result[1] / 100;
              var hue = result.result[5] / 359;
              var saturation = result.result[6] / 100;
              if (this.getData().model === 'color') {
                var color_temp = this.util.normalize(result.result[3], 1700, 6500);
              } else if (this.getData().model === 'lamp') {
                var color_temp = this.util.normalize(result.result[3], 2600, 5000);
              } else {
                var color_temp = this.util.normalize(result.result[3], 2700, 6500);
              }
              if(result.result[2] == 2) {
                var color_mode = 'temperature';
              } else {
                var color_mode = 'color';
              }

              if(result.result[0] === 'on' && this.getCapabilityValue('onoff') !== true) {
                this.setCapabilityValue('onoff', true);
              } else if (result.result[0] === 'off' && this.getCapabilityValue('onoff') !== false) {
                this.setCapabilityValue('onoff', false);
              }
              if (this.getCapabilityValue('dim') !== dim) {
                this.setCapabilityValue('dim', dim);
              }
              if (this.hasCapability('light_mode')) {
                if (this.getCapabilityValue('light_mode') !== color_mode) {
                  this.setCapabilityValue('light_mode', color_mode);
                }
              }
              if (this.hasCapability('light_temperature')) {
                if (this.getCapabilityValue('light_temperature') !== this.util.clamp(color_temp, 0, 1)) {
                  this.setCapabilityValue('light_temperature', this.util.clamp(color_temp, 0, 1));
                }
              }
              if (this.hasCapability('light_hue')) {
                if (this.getCapabilityValue('light_hue') !== this.util.clamp(hue, 0, 1)) {
                  this.setCapabilityValue('light_hue', this.util.clamp(hue, 0, 1));
                }
              }
              if (this.hasCapability('light_saturation')) {
                if (this.getCapabilityValue('light_saturation') !== saturation) {
                  this.setCapabilityValue('light_saturation', saturation);
                }
              }
            }
          } catch (error) {
            this.log('Unable to process message because of error: '+ error);
          }
        }
      } catch (error) {
        this.error(error);
      }
  	});
  }

  /* send commands to devices using their socket connection */
  sendCommand(id, command) {
    return new Promise((resolve, reject) => {
      if(this.connecting && this.connected === false){
        return reject('Unable to send command because socket is still connecting');
      } else if (this.connected === false && this.socket !== null) {
        this.socket.emit('error', new Error('Connection to device broken'));
        return reject('Connection to device broken');
      } else if (this.socket === null) {
        return reject('Unable to send command because socket is not available');
    	} else {
        this.socket.write(command + '\r\n');
        return resolve(true);
      }
    });
  }

  /* check if device is connecting or connected */
  isConnected(id) {
  	if (this.connecting === true || this.connected === true) {
      return true;
  	} else {
      return false;
    }
  }

  async saveState(device) {
    return new Promise(async (resolve, reject) => {
      try {
        let savedState = {
          "onoff": await device.getCapabilityValue("onoff"),
          "dim": await device.getCapabilityValue("dim")
        }
        if (device.hasCapability("light_temperature")) {
          savedState.light_temperature = await device.getCapabilityValue("light_temperature");
        }
        if (device.hasCapability("light_hue")) {
          savedState.light_hue = await device.getCapabilityValue("light_hue");
        }
        if (device.hasCapability("light_saturation")) {
          savedState.light_saturation = await device.getCapabilityValue("light_saturation");
        }
        if (device.hasCapability("night_mode")) {
          savedState.night_mode = await device.getCapabilityValue("night_mode");
        }
        if (device.hasCapability("onoff.bg")) {
          savedState.onoff_bg = await device.getCapabilityValue("onoff.bg");
        }
        if (device.hasCapability("dim.bg")) {
          savedState.dim_bg = await device.getCapabilityValue("dim.bg");
        }
        if (device.hasCapability("light_temperature.bg")) {
          savedState.light_temperature_bg = await device.getCapabilityValue("light_temperature.bg");
        }

        await device.setStoreValue("savedstate", savedState);

        return resolve(true);
      } catch (error) {
        return reject(error);
      }
    })
  }

  async setState(device) {
    return new Promise(async (resolve, reject) => {
      try {
        let savedState = device.getStoreValue("savedstate");

        if (device.getCapabilityValue("onoff") != savedState.onoff) {
          device.triggerCapabilityListener("onoff", savedState.onoff);
        }
        if (device.getCapabilityValue("dim") != savedState.dim) {
          device.triggerCapabilityListener("dim", savedState.dim);
        }
        if (device.getCapabilityValue("light_temperature") != savedState.light_temperature) {
          device.triggerCapabilityListener("light_temperature", savedState.light_temperature);
        }
        if (device.getCapabilityValue("light_hue") != savedState.light_hue) {
          device.triggerCapabilityListener("light_hue", savedState.light_hue);
        }
        if (device.getCapabilityValue("light_saturation") != savedState.light_saturation) {
          device.triggerCapabilityListener("light_saturation", savedState.light_saturation);
        }
        if (device.getCapabilityValue("night_mode") != savedState.night_mode) {
          device.triggerCapabilityListener("night_mode", savedState.night_mode);
        }
        if (device.getCapabilityValue("onoff.bg") != savedState.onoff_bg) {
          device.triggerCapabilityListener("onoff.bg", savedState.onoff_bg);
        }
        if (device.getCapabilityValue("dim.bg") != savedState.dim_bg) {
          device.triggerCapabilityListener("dim.bg", savedState.dim_bg);
        }
        if (device.getCapabilityValue("light_temperature.bg") != savedState.light_temperature_bg) {
          device.triggerCapabilityListener("light_temperature.bg", savedState.light_temperature_bg);
        }

        return resolve(true);
      } catch (error) {
        return reject(error);
      }
    })
  }

}

module.exports = YeelightDevice;
