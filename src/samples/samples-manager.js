import Tone, { Player } from 'tone';
import drumUrls from './sound';
import beepSound from './sound/effect/beep.wav';

export default class SamplesManager {
  constructor() {
    this.drumUrls = drumUrls;

    // effects
    this.effects = [];
    this.effects[0] = new Tone.Player(beepSound).toMaster();
  }


  triggerSoundEffect(index = 0) {
    if (index > -1 && index < this.effects.length) {
      console.log(`trigger: ${index}`);
      this.effects[index].start();
    }
  }
}
