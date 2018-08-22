/* global document */
/* global THREE */
/* global noise */

class MCEnvironment {
  // environment constuctor
  constructor() {
    // set up basic THREE.js components
    this.renderer = new THREE.WebGLRenderer();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      45, // FoV
      window.innerWidth / window.innerHeight, // Ratio
      0.1, // near
      800, // far
    );

    // add some lights to the scene
    this.scene.add(MCEnvironment.createLight(1, 10));
    this.scene.add(MCEnvironment.createLight(0.5, -10));

    // x: -59.4890804496197, y: 91.05971534730678, z: -63.95753916107502
    this.camera.position.set(560, 240, 160);
    this.camera.lookAt(200, 0, 80);

    // terrain generation settings
    noise.seed(Math.random()); // initialize the noise seed
    this.chunkSize = 16; // 16 by 16 blocks;
    this.blockSize = 10; // 10 THREE.js units
    this.heightMultiplier = 100; // increases the 'amplitude' of the noise
    this.widthMultiplier = 100; // smooths the noise
    this.totalChunkSize = this.chunkSize * this.blockSize;
    this.renderRange = 2; // render chunks in a radius of 1 chunks
    this.chunkBlocks = this.chunkSize ** 2;

    // THREE.TextureLoader.crossOrigin = "";
    this.textureLoader = new THREE.TextureLoader();
    this.textureLoader.setCrossOrigin(null);
    this.textureLoader.setPath('res/');
    this.sideTexture = MCEnvironment.withNearest(this.textureLoader.load('side.jpg'));
    this.topTexture = MCEnvironment.withNearest(this.textureLoader.load('top.jpg'));
    this.bottomTexture = MCEnvironment.withNearest(this.textureLoader.load('bottom.jpg'));
    this.sideMaterial = new THREE.MeshLambertMaterial({ map: this.sideTexture });
    this.topMaterial = new THREE.MeshLambertMaterial({ map: this.topTexture });
    this.cubeMaterial = [
      this.sideMaterial,
      this.sideMaterial,
      this.topMaterial,
      this.sideMaterial,
      this.sideMaterial,
      this.sideMaterial,
    ];

    this.cubeGeom = new THREE.BoxGeometry(
      this.blockSize, this.blockSize, this.blockSize,
    );

    this.cube = new THREE.Mesh(this.cubeGeom, this.cubeMaterial);

    // render settings
    this.maxFrameRate = 30;
    this.minFrameInterval = 1000 / this.maxFrameRate;
    this.prevFrame = Date.now();

    // tick settings
    this.chunkTickRate = 2; // times per second
    this.chunkTickInterval = 1000 / this.chunkTickRate;
    this.prevChunkUpdate = Date.now();

    // move rate
    this.moveRate = -20; // units per second
    this.centre = 0;

    // add some fog
    this.scene.fog = new THREE.Fog('#70b8dc', 340, 800);

    // data storage
    this.activeChunks = {}; // chunk-coords keys

    // bind some of our functions we don't want to lose bindings
    this.init = this.init.bind(this);
    this.tick = this.tick.bind(this);
    this.resize = this.resize.bind(this);

    // tell document to start rendinering when it's ready.
    document.addEventListener('DOMContentLoaded', this.init);
  }

  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    // console.log('resizing');
  }

  // delta: number of milliseconds since last frame was drawn
  pan(delta) {
    // moveRate = per second, convert to since last frame
    const percentOfSecond = delta / 1000;
    const amountToMove = this.moveRate * percentOfSecond;
    // console.log('framedelta(ms):', delta, 'percent:', percentOfSecond, 'move:', amountToMove);
    this.camera.position.x += amountToMove;
    this.centre += amountToMove;
    // console.log(this.centre);
  }

  frameLimiter() {
    const now = Date.now();
    // console.log(now);
    const interval = now - this.prevFrame;
    // console.log(interval);
    if (interval >= this.minFrameInterval) {
      this.prevFrame = now;
      this.pan(interval);
      // console.log('rendering new frame!')
      this.updateFrame();
    }
    requestAnimationFrame(this.tick);
  }

  init() {
    // setup the renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor('#70b8dc');
    // this.renderer.shadowMap.enabled = true;
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    document.body.appendChild(this.renderer.domElement);
    window.addEventListener('resize', this.resize);

    // generate initial chunks
    this.updateChunks();

    // enable camera controls
    // this.controls = new THREE.OrbitControls(
    //   this.camera,
    //   this.renderer.domElement,
    // );

    // begin processing
    this.tick();
  }

  updateFrame() {
    this.renderer.render(this.scene, this.camera);
  }

  // tick should be run once every frame to update physics, object locations and animations.
  tick() {
    // console.log(this.centre);
    // tick logic, animation etc happens here
    this.updateChunks();
    // this.pan();

    // draw new frame and call tick again with frameLimiter
    this.frameLimiter();
  }

  removeChunks(visibleChunks) {
    // go throuch each active chunk
    Object.keys(this.activeChunks).forEach((chunkID) => {
      // if it's not in the visible chunk, it's out of render range
      if (visibleChunks[chunkID] === undefined) {
        // remove the blocks in this chunk
        this.activeChunks[chunkID].forEach((block) => {
          this.scene.remove(block);
        });
        // remove this key from active chunks
        delete this.activeChunks[chunkID];
      }
    });
    // console.log('removing old chunks took:', Date.now() - now,'ms')
  }

  // get the location of chunks within the draw distance and draw them
  updateChunks() {
    // limite rate of chunk updates
    const now = Date.now();
    const interval = now - this.prevChunkUpdate;
    if (interval < this.chunkTickInterval) {
      return;
    }

    this.prevChunkUpdate = now;

    // console.log('updating chunks');
    // get the centre point to calculate from
    const centerPoint = {};
    centerPoint.x = this.centre;
    centerPoint.z = 0;
    // console.log(centerPoint);

    let centerX = MCEnvironment.stepwise(centerPoint.x, this.totalChunkSize);
    let centerZ = MCEnvironment.stepwise(centerPoint.z, this.totalChunkSize);

    centerX /= this.totalChunkSize;
    centerZ /= this.totalChunkSize;

    const visibleChunks = {}; // will store all the chunks visible in this update

    // loop from -renderRange to renderRange (eg -4 to 4) for x and z to get chunks
    for (let x = this.renderRange * -1; x <= this.renderRange; x += 1) {
      for (let z = this.renderRange * -1; z <= this.renderRange; z += 1) {
        // global coordinates for this chunk
        const chunkX = centerX + x;
        const chunkZ = centerZ + z;
        const chunkID = `${chunkX},${chunkZ}`;

        // store this chunk id in an object for easy lookup
        visibleChunks[chunkID] = true;

        // draw chunk only if it's not already active
        if (this.activeChunks[chunkID] === undefined) {
          this.generateChunk(chunkX, chunkZ);
        }
      }
    }

    // remove chunks that are no longer visible
    this.removeChunks(visibleChunks);
    // console.log('updating chunks took', Date.now() - now, 'ms - center:',centerX,',',centerZ);
    // console.log('active chunks:', Object.keys(this.activeChunks).length);
  }

  // this will generate the surface layer for the chunk
  generateChunk(x = 0, z = 0) {
    const cx = x * this.chunkSize;
    const cz = z * this.chunkSize;

    // initialise storage for this chunk
    const chunkID = `${x},${z}`;
    this.activeChunks[chunkID] = new Array(this.chunkBlocks);

    // console.log('origin of chunk:', cx, cz)
    // loop through the layer of chunk size
    let index = 0;
    for (let i = 0; i < this.chunkSize; i += 1) {
      for (let j = 0; j < this.chunkSize; j += 1) {
        // get noise for this grid square
        // +x and z to make it relative to this chunk
        const bx = i + cx;
        const bz = j + cz;

        const bxFreq = bx / this.widthMultiplier;
        const bzFreq = bz / this.widthMultiplier;

        // get the height of the terrain in normalized blocks
        const heightNoise = noise.simplex2(bxFreq, bzFreq) * this.heightMultiplier;
        const height = MCEnvironment.stepwise(heightNoise, this.blockSize);

        const block = this.generateBlock(bx * this.blockSize, bz * this.blockSize, height);

        // store this blocks reference so we can remove it later
        this.activeChunks[chunkID][index] = block;
        index += 1;
      }
    }
    // console.log('generating individual chunk {', chunkID ,'} took:', Date.now() - now, "ms")
  }

  generateBlock(x, z, height) {
    // const cube = new THREE.Mesh(this.cubeGeom, this.cubeMaterial);
    // cube.castShadow = true;
    // cube.receiveShadow = true;
    const cube = this.cube.clone();
    cube.position.set(x, height, z);

    this.scene.add(cube);
    return cube;
  }

  static stepwise(value, step) {
    return Math.round(value / step) * step;
  }

  static createLight(strength, direction) {
    const light = new THREE.DirectionalLight(0xffffff, strength);
    // light.castShadow = true;
    // light.shadow.mapSize.width = 1024;
    // light.shadow.mapSize.height = 1024;

    light.position.set(direction, 10, direction);
    return light;
  }

  static measure(name, fn) {
    // get args supplied for fn
    // eslint-disable-next-line prefer-rest-params
    const args = arguments.length === 1 ? [arguments[0]] : Array(...arguments).slice(2);

    const then = Date.now();
    const rval = fn.apply(this, args);
    // eslint-disable-next-line no-console
    console.log(name, 'took', Date.now() - then, 'ms');
    return rval;
  }

  static withNearest(texture) {
    const nearTex = texture;
    nearTex.minFilter = THREE.NearestFilter;
    nearTex.magFilter = THREE.NearestFilter;
    return nearTex;
  }
}

// eslint-disable-next-line no-unused-vars
const env = new MCEnvironment();
