'use strict';

const Homey = require('homey');
const tinycolor = require('tinycolor2');

class YeelightApp extends Homey.App {

  onInit() {
    this.log('Initializing Yeelight app ...');

    new Homey.FlowCardCondition('yeelightNightmode')
      .register()
      .registerRunListener((args, state) => {
        return args.device.getCapabilityValue('night_mode');
      })

    new Homey.FlowCardAction('yeelightDefault')
      .register()
      .registerRunListener((args, state) => {
        return args.device.sendCommand(args.device.getData().id, '{"id":1,"method":"set_default","params":[]}');
      })

    new Homey.FlowCardAction('yeelightFlowBrightness')
      .register()
      .registerRunListener((args, state) => {
        return args.device.sendCommand(args.device.getData().id, '{"id":1,"method":"start_cf","params":[1, '+ args.action +', "'+ args.duration +', 2, '+ args.temperature +', '+ args.brightness +'"]}');
      })

    new Homey.FlowCardAction('yeelightTemperatureScene')
      .register()
      .registerRunListener((args, state) => {
        return args.device.sendCommand(args.device.getData().id, '{"id":1, "method":"set_scene", "params":["ct", '+ args.temperature +', '+ args.brightness +']}');
      })

    new Homey.FlowCardAction('yeelightColorScene')
      .register()
      .registerRunListener((args, state) => {
        const color = tinycolor(args.color);
        const rgb = color.toRgb();
        const colordecimal = (rgb.r * 65536) + (rgb.g * 256) + rgb.b;
        if (args.device.getData().model == 'ceiling4' || args.device.getData().model == 'ceiling10') {
          return args.device.sendCommand(args.device.getData().id, '{"id":1, "method":"bg_set_scene", "params":["color", '+ colordecimal +', '+ args.brightness +']}');
        } else {
          return args.device.sendCommand(args.device.getData().id, '{"id":1, "method":"set_scene", "params":["color", '+ colordecimal +', '+ args.brightness +']}');
        }
      })

    new Homey.FlowCardAction('yeelightCustomCommand')
      .register()
      .registerRunListener((args, state) => {
        return args.device.sendCommand(args.device.getData().id, args.command);
      })

    new Homey.FlowCardAction('yeelightNightMode')
      .register()
      .registerRunListener((args, state) => {
        const night_mode = args.mode == 'night'
        return args.device.triggerCapabilityListener('night_mode', night_mode);
      })

    new Homey.FlowCardAction('yeelightAmbilightSwitch')
      .register()
      .registerRunListener((args, state) => {
        if (args.switch == 'on') {
          var switch_bg = true;
        } else {
          var switch_bg = false;
        }
        return args.device.triggerCapabilityListener('onoff.bg', switch_bg);
      })

    new Homey.FlowCardAction('yeelightAmbilightDim')
      .register()
      .registerRunListener((args, state, opts) => {
        var duration_bg = args.duration_bg * 1000;
        return args.device.triggerCapabilityListener('dim.bg', args.brightness, {'duration': duration_bg});
      })

    new Homey.FlowCardAction('yeelightAmbilightTemperature')
      .register()
      .registerRunListener((args, state) => {
        return args.device.triggerCapabilityListener('light_temperature.bg', args.temperature);
      })

    new Homey.FlowCardAction('yeelightSaveState')
      .register()
      .registerRunListener((args, state) => {
        return args.device.saveState(args.device);
      })

    new Homey.FlowCardAction('yeelightSetState')
      .register()
      .registerRunListener((args, state) => {
        return args.device.setState(args.device);
      })

  }
}

module.exports = YeelightApp;
