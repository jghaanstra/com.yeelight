'use strict';

const Homey = require('homey');
const Util = require('../../lib/util.js');

const typeCapabilityMap = {
	'mono'      : [ 'onoff', 'dim' ],
  'mono1'      : [ 'onoff', 'dim' ],
  'color'     : [ 'onoff', 'dim', 'light_hue', 'light_saturation', 'light_temperature', 'light_mode' ],
  'colorc'    : [ 'onoff', 'dim', 'light_hue', 'light_saturation', 'light_temperature', 'light_mode' ],
  'stripe'    : [ 'onoff', 'dim', 'light_hue', 'light_saturation', 'light_temperature', 'light_mode' ],
  'ct'        : [ 'onoff', 'dim', 'light_temperature' ],  
  'bslamp'    : [ 'onoff', 'dim', 'light_hue', 'light_saturation', 'light_temperature', 'light_mode' ],
  'bslamp1'    : [ 'onoff', 'dim', 'light_hue', 'light_saturation', 'light_temperature', 'light_mode' ],
  'bslamp2'   : [ 'onoff', 'dim', 'light_hue', 'light_saturation', 'light_temperature', 'light_mode' ],
  'ceiling'   : [ 'onoff', 'dim', 'light_temperature', 'light_mode', 'night_mode' ],
  'ceiling4'  : [ 'onoff', 'onoff.bg', 'dim', 'dim.bg', 'light_hue', 'light_saturation', 'light_temperature', 'light_temperature.bg', 'light_mode', 'light_mode.bg', 'night_mode' ],
  'ceilc'     : [ 'onoff', 'onoff.bg', 'dim', 'dim.bg', 'light_hue', 'light_saturation', 'light_temperature', 'light_temperature.bg', 'light_mode', 'light_mode.bg', 'night_mode' ],
  'ceiling5+' : [ 'onoff', 'onoff.bg', 'dim', 'dim.bg', 'light_hue', 'light_saturation', 'light_temperature', 'light_temperature.bg', 'light_mode', 'light_mode.bg', 'night_mode' ],
  'ceiling10' : [ 'onoff', 'onoff.bg', 'dim', 'dim.bg', 'light_hue', 'light_saturation', 'light_temperature', 'light_temperature.bg', 'light_mode', 'light_mode.bg', 'night_mode' ],
  'ceiling15' : [ 'onoff', 'dim', 'light_temperature', 'light_mode', 'night_mode' ],
  'ceiling20' : [ 'onoff', 'onoff.bg', 'dim', 'dim.bg', 'light_hue', 'light_saturation', 'light_temperature', 'light_temperature.bg', 'light_mode', 'light_mode.bg', 'night_mode' ],
  'desklamp'  : [ 'onoff', 'dim', 'light_temperature' ],
  'lamp'      : [ 'onoff', 'dim', 'light_temperature' ],
  'lamp15'      : [ 'onoff', 'onoff.bg', 'dim', 'dim.bg', 'light_hue', 'light_saturation', 'light_temperature', 'light_temperature.bg', 'light_mode', 'light_mode.bg', 'night_mode' ]
}

const typeIconMap = {
	'mono'      : 'bulb.svg',
	'color'     : 'bulb.svg',
  'colorc'    : 'gu10.svg',
  'stripe'    : 'strip.svg',
  'bslamp'    : 'bslamp.svg',
  'bslamp1'    : 'bslamp.svg',
  'bslamp2'   : 'bslamp2.svg',
  'ceiling'   : 'ceiling.svg',
  'ceiling4'  : 'ceiling4.svg',
  'ceilc'     : 'ceiling4.svg',
  'ceiling5+'  : 'ceiling.svg',
  'ceiling10' : 'ceiling10.svg',
  'ceiling15' : 'ceiling4.svg',
  'ceiling20' : 'ceiling4.svg',
  'desklamp'  : 'desklamp.svg',
  'lamp'      : 'desklamp.svg',
  'lamp15'    : 'desklamp.svg'
}

class YeelightDriver extends Homey.Driver {

  onInit() {
    if (!this.util) this.util = new Util({homey: this.homey});
  }

  async onPairListDevices() {
    try {
      let result = await this.util.discover();
      let devices = [];

      // for device identification purposes
      this.log(result);

      for (let i in result) {
        var name = '';
        var model = '';

        if(result[i].model.startsWith('color')) {
          if(result[i].model === 'colorc') {
            var name = this.homey.__('driver.yeelight_gu10')+ ' (' + result[i].address + ')';
            var model = 'colorc';
          } else {
            var name = this.homey.__('driver.yeelight_bulb_color')+ ' (' + result[i].address + ')';
            var model = 'color';
          }
        } else if (result[i].model.startsWith('mono')) {
          var name = this.homey.__('driver.yeelight_bulb_white')+ ' (' + result[i].address + ')';
          var model = 'mono';
        } else if (result[i].model == 'ct') {
          var name = this.homey.__('driver.yeelight_bulb_white')+ ' (' + result[i].address + ')';
        } else if (result[i].model.startsWith('strip')) {
          var name = this.homey.__('driver.yeelight_led_strip')+ ' (' + result[i].address + ')';
          var model = 'stripe';
        } else if (result[i].model.startsWith('bslamp')) {
          var name = this.homey.__('driver.yeelight_bedside_lamp')+ ' (' + result[i].address + ')';
          if (result[i].model == 'bslamp2') {
            var model = result[i].model;
          } else {
            var model = 'bslamp';
          }
        } else if (result[i].model.startsWith('ceiling')) {
          if (result[i].model == 'ceiling' || result[i].model == 'ceiling1' || result[i].model == 'ceiling2' || result[i].model == 'ceiling3') {
            var name = this.homey.__('driver.yeelight_ceiling_light')+ ' (' + result[i].address + ')';
            var model = 'ceiling';
          } else if (result[i].model == 'ceiling4') {
            var name = this.homey.__('driver.yeelight_ceiling_light')+ ' (' + result[i].address + ')';
            var model = 'ceiling4';
          } else if (result[i].model == 'ceiling5' || result[i].model == 'ceiling6' || result[i].model == 'ceiling7' || result[i].model == 'ceiling8' || result[i].model == 'ceiling9') {
            var name = this.homey.__('driver.yeelight_ceiling_light')+ ' (' + result[i].address + ')';
            var model = 'ceiling5+';
          } else if (result[i].model == 'ceiling10') {
            var name = this.homey.__('driver.yeelight_meteorite_light')+ ' (' + result[i].address + ')';
            var model = 'ceiling10';
          } else if (result[i].model == 'ceiling15') {
            var name = this.homey.__('driver.yeelight_ceiling_light')+ ' (' + result[i].address + ')';
            var model = 'ceiling15';
          } else if (result[i].model == 'ceiling20') {
            var name = this.homey.__('driver.yeelight_ceiling_light')+ ' (' + result[i].address + ')';
            var model = 'ceiling20';
          } else {
            var name = this.homey.__('driver.yeelight_ceiling_light')+ ' (' + result[i].address + ')';
            var model = 'ceiling';
          }
        } else if (result[i].model == 'ceilc') {
          var name = this.homey.__('driver.yeelight_ceiling_light')+ ' (' + result[i].address + ')';
          var model = 'ceilc';
        } else if (result[i].model.startsWith('desklamp')) {
          var name = this.homey.__('yeelight_desklamp')+ ' (' + result[i].address + ')';
          var model = 'desklamp';
        } else if (result[i].model.startsWith('lamp')) {
          var name = this.homey.__('yeelight_desklamp')+ ' (' + result[i].address + ')';
          if (result[i].model == 'lamp15') {
            var model = result[i].model;
          } else {
            var model = 'lamp';
          }
        } else {
          var name = 'Unknown model'+ ' (' + result[i].model + ')';
          var model = 'ceiling';
        }
        devices.push({
          name: name,
          data: {
            id: result[i].id,
            model: result[i].model
          },
          settings: {
            address: result[i].address,
            port: result[i].port
          },
          capabilities: typeCapabilityMap[model],
          icon: typeIconMap[model]
        });
      }

      return devices;
    } catch (error) {
      this.log(error);
      throw new Error(error);
    }
  }

}

module.exports = YeelightDriver;
