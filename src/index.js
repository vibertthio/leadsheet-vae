import React, { Component } from 'react';
import { render } from 'react-dom';
import styles from './index.module.scss';
import info from './assets/info.png';
import SamplesManager from './samples/samples-manager';
import Sound from './leadsheet/sound';
import Renderer from './render/renderer';
import playSvg from './assets/play.png';
import pauseSvg from './assets/pause.png';
import shufflePng from './assets/shuffle.png';
import sig from './assets/sig.png';
import TWEEN from '@tweenjs/tween.js';

class App extends Component {
  // Component (React) & initialization
  constructor(props) {
    super(props);

    this.state = {
      open: false,
      playing: false,
      slash: true,
      dragging: false,
      loading: true,
      loadingProgress: 0,
      loadingSamples: false,
      currentTableIndex: 4,
      gate: 0.2,
      bpm: 120,
      instructionStage: 0,
      waitingServer: false,
      screen: {
        width: window.innerWidth,
        height: window.innerHeight,
        ratio: window.devicePixelRatio || 1,
      },
    };

    this.samplesManager = new SamplesManager();

    this.sound = new Sound(this),
    this.canvas = [];
    this.matrix = [];
    this.chords = [];
    this.tempMatrix = [];
    this.beat = 0;

    this.diffMatrix = [];
    this.diffAnimationAlpha = 0;

    this.serverUrl = 'http://musicai.citi.sinica.edu.tw/drumvae/';
    this.leadsheetServerUrl = 'http://140.109.135.76:5001/';


    // animation
    this.TWEEN = TWEEN;
    this.pauseChangeMatrix = false;
    this.pauseChangeLatent = false;
  }

  componentDidMount() {
    this.renderer = new Renderer(this, this.canvas);
    if (!this.state.loading) {
      this.renderer.draw(this.state.screen);
    }
    window.addEventListener('keydown', this.onKeyDown.bind(this), false);
    window.addEventListener('resize', this.handleResize.bind(this, false));
    window.addEventListener('click', this.handleClick.bind(this));
    window.addEventListener('mousedown', this.handleMouseDown.bind(this));
    window.addEventListener('mousemove', this.handleMouseMove.bind(this));
    window.addEventListener('mouseup', this.handleMouseUp.bind(this));

    requestAnimationFrame(() => { this.update() });
    this.getLeadsheetVaeStatic(false);
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this.onKeyDown.bind(this));
    window.removeEventListener('click', this.handleClick.bind(this));
    window.removeEventListener('mousedown', this.handleMouseDown.bind(this));
    window.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    window.removeEventListener('mouseup', this.handleMouseUp.bind(this));
    window.removeEventListener('resize', this.handleResize.bind(this, false));
  }


  // Data control:

  // Leadsheet
  changeMatrix(mat) {
    this.tempMatrix = mat;

    if (!this.pauseChangeMatrix) {
      this.updateMatrix()
    }
  }

  changeChords(c) {
    this.tempChords = c;

    if (!this.pauseChangeMatrix) {
      this.updateChords();
    }
  }

  updateMatrix() {
    const m = this.tempMatrix;
    this.matrix = m;
    this.renderer.changeMatrix(m);
    this.sound.changeMatrix(m);
  }

  updateChords() {
    this.chords = this.tempChords;
    this.sound.chords = this.tempChords;
    this.renderer.chords = this.tempChords;
  }



  changeLatent(latent) {
    if (this.pauseChangeLatent) {
      this.tempLatent = latent;
    } else {
      this.renderer.latent = latent;
    }
    this.pauseChangeLatent = false;
  }


  // Server
  // Leadsheet
  // 1. GET
  // 2. POST
  getLeadsheetVae(url, restart = true) {
    fetch(url, {
      headers: {
        'content-type': 'application/json'
      },
      method: 'GET', // *GET, POST, PUT, DELETE, etc.
    })
      .then(r => r.json())
      .then(r => {

        this.changeMatrix(r['melody']);
        this.changeChords(r['chord']);
        // this.changeLatent(r['z'][0].slice(0, 32));
        this.changeLatent(r['z'][0]);

        this.bpms = r['tempo'];
        if (restart) {
          console.log('start sound');
          this.start();
          this.sound.changeSection(0);
          this.renderer.triggerStartAnimation();
        }

        if (this.renderer.instructionState === 0) {
          this.renderer.pianorollGrids[0].showingInstruction = true;
        }

        this.setState({
          songs: r['songnames'],
          loading: false,
          rhythmThreshold: r['theta'],
          waitingServer: false,
        });
      })
      .catch(e => console.log(e));
  }

  getLeadsheetVaeStatic(restart = true) {
    const url = this.leadsheetServerUrl + 'static';
    this.getLeadsheetVae(url, restart);
  }

  getLeadsheetVaeRandom() {
    this.renderer.latentGraph.showIndication = true;
    this.setState({
      waitingServer: true,
    });
    const randId = Math.floor(Math.random() * 60);
    console.log(`random id: ${randId}`);
    const url = this.leadsheetServerUrl + `static/${randId}`;
    this.getLeadsheetVae(url, restart);
  }

  postLeadsheetVae(url, body, restart = false) {
    fetch(url, {
      method: 'POST', // *GET, POST, PUT, DELETE, etc.
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json'
      },
      body,
    })
      .then(r => r.json())
      .then(r => {
        this.changeMatrix(r['melody']);
        this.changeChords(r['chord']);
        this.changeLatent(r['z'][0]);
        // console.log(r);
        if (restart) {
          this.start();
        }
      })
      .catch(e => console.log(e));
  }

  postLeadsheetVaeAdjustLatent(latent, restart = false) {
    const url = this.leadsheetServerUrl + 'api/latent2seq';
    const body = JSON.stringify({
      'z_client': [ latent ],
    });
    this.postLeadsheetVae(url, body, false);
  }

  // Utilities
  start() {
    this.sound.start();
    this.renderer.playing = true;
    this.setState({
      playing: true,
    });
  }

  trigger() {
    const playing = this.sound.trigger();
    this.renderer.playing = playing;
    this.setState({
      playing,
    });
  }

  nextInstruction() {
    const { instructionStage } = this.state;
    this.setState({
      instructionStage: instructionStage + 1,
    });
  }

  handleLoadingSamples(amt) {
    this.setState({
      loadingProgress: amt,
    });
    if (amt === 8) {
      const playing = this.samplesManager.trigger();
      this.setState({
        // playing,
        loadingSamples: false,
      });
    }
  }


  // Menu control
  openMenu() {
    document.getElementById('menu').style.height = '100%';
    this.setState({
      open: true,
    });
  }

  closeMenu() {
    document.getElementById('menu').style.height = '0%';
    this.setState({
      open: false,
    });
  }


  // Events handling
  // 1. mouse
  handleMouseDown(e) {
    e.stopPropagation();
    const { slash, open } = this.state;
    if (!slash && !open) {
      const [dragging, onGrid] = this.renderer.handleMouseDown(e);
      if (dragging) {
        this.setState({
          dragging,
        });
      }
    }
  }

  handleMouseUp(e) {
    e.stopPropagation();
    // const dragging = this.renderer.handleMouseDown(e);
    const { slash, open } = this.state;
    const { selectedLatent, latent } = this.renderer;
    if (!slash && !open) {

      if (this.state.dragging) {
        this.pauseChangeMatrix = true;
        this.samplesManager.triggerSoundEffect(0);

        this.renderer.decoderAniStart(() => {
          // this.start();

          if (this.diffAnimation) {
            this.diffAnimation.start();
          }
          this.pauseChangeMatrix = false;
          this.updateMatrix();
          this.updateChords();
        });

        // this.postDrumVaeAdjustLatent(latent);
        this.postLeadsheetVaeAdjustLatent(latent);

        if (this.state.instructionStage === 0) {
          this.nextInstruction();
        }
      }

      this.setState({
        dragging: false,
      });
    }
  }

  handleMouseMove(e) {
    e.stopPropagation();
    if (!this.state.dragging) {
      this.renderer.handleMouseMove(e);
    }
    this.renderer.handleDraggingOnGraph(e);
  }

  // 2. Key
  onKeyDown(e) {
    e.stopPropagation();
    const { slash, loadingSamples } = this.state;
    if (!slash) {
      if (!loadingSamples) {
        // console.log(`key: ${e.keyCode}`);
        if (e.keyCode === 32) {
          // space
          const playing = this.sound.trigger();
          this.setState({
            playing,
          });
        }
        if (e.keyCode === 65) {
          // a
          this.renderer.triggerDisplay();
        }
        if (e.keyCode === 82) {
          // r
          this.getLeadsheetVaeRandom();
        }
        if (e.keyCode === 84) {
          // t
          this.getLeadsheetVaeStatic();
        }


        if (e.keyCode === 49) {
          // 1
        }
      }
    }
  }

  // 3. window resize
  handleResize(value, e) {
    this.setState({
      screen: {
        width: window.innerWidth,
        height: window.innerHeight,
        ratio: window.devicePixelRatio || 1,
      }
    });
  }

  // 4. UIs
  handleClick(e) {
    e.stopPropagation();
  }

  handleClickMenu() {
    const { open } = this.state;
    if (open) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  handleChangeGateValue(e) {
    const v = e.target.value;
    const gate = v / 100;
    // console.log(`gate changed: ${gate}`);
    this.setState({ gate });
    this.changeMatrix();
  }

  handleChangeBpmValue(e) {
    const v = e.target.value;
    // 0~100 -> 60~120
    const bpm = v;
    console.log(`bpm changed: ${bpm}`);
    this.setState({ bpm });
    this.sound.changeBpm(bpm);
  }

  handleClickPlayStopIcon() {
    const playing = this.sound.trigger();
    this.setState({
      playing,
    });
  }

  handleClickPlayButton() {
    const id =  'splash';
    const splash = document.getElementById(id);
    splash.style.opacity = 0.0;
    setTimeout(() => {
      splash.style.display = 'none';
      this.setState({
        slash: false,
      });
    }, 500);
  }


  // Render
  update() {
    const { beat, barIndex, sectionIndex } = this.sound;
    if (!this.state.loading) {
      this.renderer.draw(this.state.screen, sectionIndex, barIndex, beat);
    }

    TWEEN.update();
    requestAnimationFrame(() => { this.update() });
  }

  render() {
    const { instructionStage, gate, bpm } = this.state;
    const loadingText = 'play';
    return (
      <div>

        {/* Landing Page */}
        <section className={styles.splash} id="splash">
          <div className={styles.wrapper}>
            <h1>Latent<br/>Inspector</h1>
            <h2>
              = 🎹 Song + 🤖 VAE
            </h2>
            <div className="device-supported">
              <p className={styles.description}>
                An interactive demo based on latent vector to generate drum pattern.
                Modify the 304-dim latent vector to produce new drum patterns.
              </p>

              <button
                className={styles.playButton}
                id="splash-play-button"
                onClick={() => this.handleClickPlayButton()}
              >
                {loadingText}
              </button>

              <p className={styles.builtWith}>
                Built with tone.js + Flask.
                <br />
                Learn more about <a className={styles.about} target="_blank" href="https://github.com/vibertthio">how it works.</a>
              </p>

              <p>Made by</p>
              <img className="splash-icon" src={sig} width="100" height="auto" alt="Vibert Thio Icon" />
            </div>
          </div>
          <div className={styles.badgeWrapper}>
            <a className={styles.magentaLink} href="http://musicai.citi.sinica.edu.tw/" target="_blank" >
              <div>Music and AI Lab</div>
            </a>
          </div>
          <div className={styles.privacy}>
            <a href="https://github.com/vibertthio" target="_blank">Privacy &amp; </a>
            <a href="https://github.com/vibertthio" target="_blank">Terms</a>
          </div>
        </section>

        {/* Title & Tips */}
        <div className={styles.title}>
          <a href="https://github.com/vibertthio/drum-vae-client" target="_blank" rel="noreferrer noopener">
            Latent Inspector
          </a>
          <button
            className={styles.btn}
            onClick={() => this.handleClickMenu()}
            onKeyDown={e => e.preventDefault()}
          >
            <img alt="info" src={info} />
          </button>

          <div className={styles.tips} id="tips">
            {instructionStage < 2 ? <p>🙋‍♀️Tips</p> : ''}
            {instructionStage === 0 ? (<p>👇Drag the <font color="#2ecc71">green dots</font> in the latent vector</p>) : ''}
            {instructionStage > 0 ? <p>🎉Have fun!</p> : ''}
          </div>
        </div>

        {/* Canvas */}
        <div>
          <canvas
            ref={ c => this.canvas = c }
            className={styles.canvas}
            width={this.state.screen.width * this.state.screen.ratio}
            height={this.state.screen.height * this.state.screen.ratio}
          />
        </div>

        {/* Controls */}
        <div className={styles.control}>
          <div className={styles.slider}>
            <div>
              <input type="range" min="1" max="100" />
            </div>
            <button onClick={() => this.handleClickPlayStopIcon()} onKeyDown={e => e.preventDefault()}>
              {
                !this.state.playing ?
                  (<img src={playSvg} width="30" height="30" alt="submit" />) :
                  (<img src={pauseSvg} width="30" height="30" alt="submit" />)
              }
            </button>
            <button onClick={() => this.getLeadsheetVaeRandom()} onKeyDown={e => e.preventDefault()}>
              <img src={shufflePng} width="25" height="25" alt="shuffle" />
            </button>
            <div>
              <input type="range" min="60" max="180" value={bpm} onChange={this.handleChangeBpmValue.bind(this)}/>
            </div>
          </div>
        </div>

        {/* Overlay */}
        <div id="menu" className={styles.overlay}>
          <button className={styles.overlayBtn} onClick={() => this.handleClickMenu()} />
          <div className={styles.intro}>
            <p>
              <strong>$ Latent Inspector $</strong>
              <br />An interactive demo based on latent vector to generate drum pattern. Made by{' '}
              <a href="https://vibertthio.com/portfolio/" target="_blank" rel="noreferrer noopener">
                Vibert Thio
              </a>.{' Source code is on '}
              <a
                href="https://github.com/vibertthio/drum-vae-client"
                target="_blank"
                rel="noreferrer noopener"
              >
                GitHub.
              </a>
            </p>
            <p>
              <strong>$ How to use $</strong>
              <br /> [space]: play/pause
              <br /> [r]: random sample
              <br /> [drag]: rag the circular diagram to change the latent vector
              <br /> [click]: click to change the drum pattern
            </p>
          </div>
          <button className={styles.overlayBtn} onClick={() => this.handleClickMenu()} />
        </div>

      </div>
    );
  }
}

render(<App />, document.getElementById('root'));
