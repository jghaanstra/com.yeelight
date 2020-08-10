'use strict';

const Homey = require('homey');
const tinycolor = require('tinycolor2');

class YeelightApp extends Homey.App {

  onInit() {
    this.log('Initializing Yeelight app ...');

    this.homey.flow.getConditionCard('yeelightNightmode')
      .registerRunListener(async (args) => {
        return await args.device.getCapabilityValue('night_mode');
      })

    this.homey.flow.getActionCard('yeelightDefault')
      .registerRunListener(async (args) => {
        return await args.device.sendCommand(args.device.getData().id, '{"id":1,"method":"set_default","params":[]}');
      })

    this.homey.flow.getActionCard('yeelightFlowBrightness')
      .registerRunListener(async (args) => {
        return await args.device.sendCommand(args.device.getData().id, '{"id":1,"method":"start_cf","params":[1, '+ args.action +', "'+ args.duration +', 2, '+ args.temperature +', '+ args.brightness +'"]}');
      })

    this.homey.flow.getActionCard('yeelightTemperatureScene')
      .registerRunListener(async (args) => {
        return await args.device.sendCommand(args.device.getData().id, '{"id":1, "method":"set_scene", "params":["ct", '+ args.temperature +', '+ args.brightness +']}');
      })

    this.homey.flow.getActionCard('yeelightColorScene')
      .registerRunListener(async (args) => {
        const color = tinycolor(args.color);
        const rgb = color.toRgb();
        const colordecimal = (rgb.r * 65536) + (rgb.g * 256) + rgb.b;
        if (args.device.getData().model == 'ceiling4' || args.device.getData().model == 'ceiling10') {
          return await args.device.sendCommand(args.device.getData().id, '{"id":1, "method":"bg_set_scene", "params":["color", '+ colordecimal +', '+ args.brightness +']}');
        } else {
          return await args.device.sendCommand(args.device.getData().id, '{"id":1, "method":"set_scene", "params":["color", '+ colordecimal +', '+ args.brightness +']}');
        }
      })

    this.homey.flow.getActionCard('yeelightCustomCommand')
      .registerRunListener(async (args) => {
        return await args.device.sendCommand(args.device.getData().id, args.command);
      })

    this.homey.flow.getActionCard('yeelightNightMode')
      .registerRunListener(async (args) => {
        const night_mode = args.mode == 'night'
        return await args.device.triggerCapabilityListener('night_mode', night_mode);
      })

    this.homey.flow.getActionCard('yeelightAmbilightSwitch')
      .registerRunListener(async (args) => {
        if (args.switch == 'on') {
          var switch_bg = true;
        } else {
          var switch_bg = false;
        }
        return await args.device.triggerCapabilityListener('onoff.bg', switch_bg);
      })

    this.homey.flow.getActionCard('yeelightAmbilightDim')
      .registerRunListener(async (args, state, opts) => {
        var duration_bg = args.duration_bg * 1000;
        return await args.device.triggerCapabilityListener('dim.bg', args.brightness, {'duration': duration_bg});
      })

    this.homey.flow.getActionCard('yeelightAmbilightTemperature')
      .registerRunListener(async (args) => {
        return await args.device.triggerCapabilityListener('light_temperature.bg', args.temperature);
      })

    this.homey.flow.getActionCard('yeelightSaveState')
      .registerRunListener(async (args) => {
        return await args.device.saveState(args.device);
      })

    this.homey.flow.getActionCard('yeelightSetState')
      .registerRunListener(async (args) => {
        return await args.device.setState(args.device);
      })

  }
}

module.exports = YeelightApp;
