import { lerpColor, roundedRect } from '../utils/utils';

export default class PianorollGrid {

  constructor(renderer, ysr = -1.5, fixed = 0) {
    this.matrix = [];
    this.noteList = [];
    this.renderer = renderer;
    this.fixed = fixed;
    this.sectionIndex = fixed;
    this.frameRatio = 1.1;

    this.gridWidth = 0;
    this.gridHeight = 0;
    this.gridXShift = 0;
    this.gridYShift = 0;

    this.darkColor = 'rgba(30, 30, 30, 1.0)';
    this.whiteColor = '#ffffff';
    this.greenColor = '#00b894';

    this.yShiftRatio = ysr;

    // animation
    this.currentNoteIndex = -1;
    this.currentNoteYShift = 0;
    this.currentChordIndex = -1;
    this.currentChordYShift = 0;
    this.newSectionYShift = 1;

    // instruction
    this.showingInstruction = false;
  }

  update(w, h) {
    const { matrix, beat, sectionIndex } = this.renderer;
    if (this.matrix !== matrix) {
      this.matrix = matrix;
      this.decodeMatrix(this.matrix);
      // this.triggerStartAnimation();
    }

    this.beat = beat;

    this.gridWidth = w;
    this.gridHeight = h;
    this.gridYShift = h * this.yShiftRatio;
  }

  decodeMatrix(mat) {

    let noteList = new Array(mat.length).fill([]).map((l, i) => {
      let list = [];
      let noteOn = false;
      let currentNote = -1;
      let currentStart = 0;
      let currentEnd = 0;
      // flatten
      let section = [].concat.apply([], mat[i].slice()).forEach((note, j) => {
        if (note !== currentNote) {

          // current note end
          if (noteOn && currentNote !== -1) {
            currentEnd = j - 1;
            list = list.concat([[currentNote, currentStart, currentEnd]]);
          }

          currentNote = note;

          // new note start
          if (note !== -1) {
            noteOn = true;
            currentStart = j;
          }
        } else if ((j === (mat[0][0].length * mat[0].length - 1)) && note !== -1) {
          // last one
          currentEnd = j;
          list = list.concat([[currentNote, currentStart, currentEnd]])
        }
      });
      return list;
    });
    this.noteList = noteList;
    // console.log('original matrix');
    // console.log(mat);
    // console.log('decoded');
    // console.log(noteList);
  }

  draw(ctx, w, h) {
    this.update(w, h)
    this.updateYShift();

    ctx.save();
    ctx.translate(this.gridXShift, this.gridYShift)

    this.drawFrame(
      ctx,
      this.gridWidth * this.frameRatio,
      this.gridHeight * this.frameRatio,
    );

    ctx.save();
    ctx.translate(-w * 0.5, -h * 0.5);

    this.drawSongName(ctx);

    // roll
    const wStep = w / (48 * 4);
    const b = this.beat % 192;

    for (let i = 0; i < 4; i += 1) {
      ctx.save();
      ctx.translate((48 * i) * wStep, 25);
      if (this.renderer.chords.length > 0) {

        const chords = this.renderer.chords[this.sectionIndex][i]
        let prevC = '';
        chords.forEach((c, j) => {
          const pos = 48 * i + 12 * j;
          ctx.save();
          if (b > pos && b < (pos + 12)) {
            if (this.currentChordIndex !== pos) {
              this.currentChordIndex = pos;
              this.currentChordYShift = 1;
            }
            ctx.translate(0, this.currentChordYShift * -5);
            ctx.fillStyle = this.greenColor;
          } else {
            ctx.fillStyle = this.whiteColor;
          }
          if (c !== prevC) {
            ctx.fillText(c, 5, -8);
          } else {
            ctx.fillText('-', 5, -8);
          }
          ctx.restore();
          ctx.translate(12 * wStep, 0)
          prevC = c;
        })
      }
      ctx.restore();
    }


    const hStep = h / 48;

    this.noteList[this.sectionIndex].forEach((item, index) => {
      const [note, start, end] = item;
      const y = 48 - (note - 48);
      let wStepDisplay = wStep * (1 - this.newSectionYShift);
      ctx.save();
      ctx.strokeStyle = 'none';
      ctx.translate(start * wStep, y * hStep);

      if ((b % 192) >= start
        && (b % 192) <= end) {
        if (this.currentNoteIndex !== index) {
          // change note
          this.currentNoteYShift = 1;
          this.currentNoteIndex = index;
        }
        ctx.fillStyle = this.whiteColor;
        ctx.fillText(note, 5, -8);
        ctx.fillStyle = this.greenColor;
        ctx.translate(0, this.currentNoteYShift * -2);
        // stretch
        // wStepDisplay *= (1 + this.currentNoteYShift * 0.1)
      } else {
        ctx.fillStyle = this.whiteColor;
      }
      ctx.fillRect(0, 0, wStepDisplay * (end - start + 1), hStep);

      ctx.restore();
    });

    // progress
    if (this.isPlaying() || b > 0) {
      ctx.save();
      ctx.translate((b % 192) * wStep, 0);
      ctx.strokeStyle = this.greenColor;
      ctx.fillStyle = this.greenColor;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, h);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, h * 0.015, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, h, h * 0.015, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    this.drawBling(
      ctx,
      this.gridWidth * this.frameRatio - 15,
      this.gridHeight * this.frameRatio - 12,
    );
    this.drawInstructionText(ctx, h, w);



    ctx.restore();
  }

  drawSongName(ctx) {
    const { songs } = this.renderer.app.state;
    let name = 'mixed';
    if (this.fixed === 0) {
      name = songs[0].substring(0, songs[0].length - 5);
    } else if (this.fixed === this.matrix.length - 1) {
      name = songs[1].substring(0, songs[1].length - 5);
    }
    ctx.save();
    ctx.translate(-5, -10);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(name, 0, 0);
    ctx.restore();
  }

  isPlaying() {
    return this.renderer.playing;
  }

  checkCurrent() {
    return (this.renderer.sectionIndex === this.fixed) || (this.fixed === -1);
  }

  updateYShift() {
    this.currentNoteYShift *= 0.9;
    this.currentChordYShift *= 0.9;
    this.newSectionYShift *= 0.9;
  }

  triggerStartAnimation() {
    this.newSectionYShift = 1;
  }

  drawFrame(ctx, w, h) {
    let ratio = 1;

    if (this.showingInstruction) {
      ratio *= 1 + Math.sin(this.renderer.frameCount * 0.12) * 0.012;
    }

    const unit = this.renderer.dist * 0.04;
    const displayW = w * ratio;
    const displayH = h * ratio;

    ctx.save();

    ctx.strokeStyle = '#FFF';

    ctx.beginPath()
    ctx.moveTo(0.5 * displayW, 0.5 * displayH - unit);
    ctx.lineTo(0.5 * displayW, 0.5 * displayH);
    ctx.lineTo(0.5 * displayW - unit, 0.5 * displayH);
    ctx.stroke();

    ctx.beginPath()
    ctx.moveTo(-0.5 * displayW, 0.5 * displayH - unit);
    ctx.lineTo(-0.5 * displayW, 0.5 * displayH);
    ctx.lineTo(-0.5 * displayW + unit, 0.5 * displayH);
    ctx.stroke();

    ctx.beginPath()
    ctx.moveTo(0.5 * displayW, -0.5 * displayH + unit);
    ctx.lineTo(0.5 * displayW, -0.5 * displayH);
    ctx.lineTo(0.5 * displayW - unit, -0.5 * displayH);
    ctx.stroke();

    ctx.beginPath()
    ctx.moveTo(-0.5 * displayW, -0.5 * displayH + unit);
    ctx.lineTo(-0.5 * displayW, -0.5 * displayH);
    ctx.lineTo(-0.5 * displayW + unit, -0.5 * displayH);
    ctx.stroke();

    ctx.restore();
  }

  drawBling(ctx, w, h) {
    if (this.showingInstruction) {
      const width = Math.max(300, w * 0.4);
      const height = h * 0.4;
      ctx.save();
      ctx.translate(-0.5 * width, -0.5 * height);
      // ctx.fillStyle = this.darkColor;
      ctx.fillStyle = 'rgba(30, 30, 30, 0.8)';
      roundedRect(ctx, 0, 0, width, height, 10);
      ctx.restore();
    }
  }

  drawInstructionText(ctx, w, h) {
    if (this.showingInstruction) {
      ctx.save();
      ctx.textAlign = 'center';
      const ratio = 0.017;

      if (this.fixed === 0) {
        ctx.fillStyle = lerpColor(
          this.whiteColor,
          this.greenColor,
          Math.pow(
            Math.sin(this.renderer.frameCount * 0.03),
            2,
          ),
        );
        ctx.fillText('Press here!', 0, -h * ratio);
        ctx.fillStyle = this.whiteColor;
        ctx.fillText('Listen to the first song', 0, h * ratio);
      } else if (this.fixed === this.matrix.length - 1) {
        ctx.fillStyle = lerpColor(
          this.whiteColor,
          this.greenColor,
          Math.pow(
            Math.sin(this.renderer.frameCount * 0.05),
            2,
          ),
        );
        ctx.fillText('Press here!', 0, -h * ratio);
        ctx.fillStyle = this.whiteColor;
        ctx.fillText('Listen to the second song', 0, h * ratio);
      } else if (this.fixed === -1) {
        ctx.fillStyle = lerpColor(
          this.whiteColor,
          this.greenColor,
          Math.pow(
            Math.sin(this.renderer.frameCount * 0.05),
            2,
          ),
        );
        ctx.fillText('Press here!', 0, -h * ratio);
        ctx.fillStyle = this.whiteColor;
        ctx.fillText('Listen to the mixing of two melodies', 0, h * ratio);
        // ctx.fillText('', 0, h * ratioMiddle);
      }

      ctx.restore();
    }
  }

  changeFixed(i) {
    this.fixed = i;
    this.sectionIndex = i;
  }


}
