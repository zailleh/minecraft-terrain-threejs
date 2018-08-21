class MCEnvironment {
  // environment constuctor
  constructor() {
    // set up baseic THREE.js components
    this.renderer = new THREE.WebGLRenderer();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      45, // FoV
      window.innerWidth / window.innerHeight, // Ratio
      0.1, // near
      1000 // far
    );

    // add some lights to the scene
    this.scene.add(this.createLight(1,10));
    this.scene.add(this.createLight(0.5,-10));

    // x: -59.4890804496197, y: 91.05971534730678, z: -63.95753916107502
    this.camera.position.set(-60, 90, -60);
    // this.camera.lookAt(1000, 1000, 80);
    
    // terrain generation settings
    noise.seed(Math.random()); // initialize the noise seed
    this.chunkSize = 16 // 16 by 16 blocks;
    this.blockSize = 10 // 10 THREE.js units
    this.heightMultiplier = 100; // increases the 'amplitude' of the noise
    this.widthMultiplier = 100; // smooths the noise
    this.totalChunkSize = this.chunkSize * this.blockSize;
    this.renderRange = 2 // render chunks in a radius of 1 chunks
    this.chunkBlocks = this.chunkSize ** 2;


    // render settings
    this.maxFrameRate = 30
    this.minFrameInterval = 1000 / this.maxFrameRate
    this.prevFrame = 0;

    // tick settings 
    this.chunkTickRate = 2 // times per second
    this.chunkTickInterval = 1000 / this.chunkTickRate
    this.prevChunkUpdate = 0;


    // data storage
    this.activeChunks = {} // chunk-coords keys

    // tell document to start rendinering when it's ready.
    document.addEventListener("DOMContentLoaded", () => this.init() );
  }

  frameLimiter() {
    const now = Date.now();
    // console.log(now);
    const interval = now - this.prevFrame
    if (interval >= this.minFrameInterval) {
      this.prevFrame = now;
      // console.log('rendering new frame!')
      this.updateFrame();
    }
    requestAnimationFrame(() => this.tick());
  }

  createLight(strength, direction) {
    const light = new THREE.DirectionalLight(0xffffff, strength);
    light.castShadow = true;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;

    light.position.set(direction,10,direction);
    return light
  }

  init() {
    // setup the renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor('#16161d'); // Eingengrau
    this.renderer.shadowMap.enabled = true;
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    document.body.appendChild(this.renderer.domElement);

    // generate initial chunks
    this.updateChunks();

    // enable camera controls
    this.controls = new THREE.OrbitControls(
      this.camera,
      this.renderer.domElement
    );

    // begin processing
    this.tick();
  }

  updateFrame() {
    this.renderer.render(this.scene, this.camera);
  }

  normalize(value, normal) {
    return Math.round(value / normal) * normal;
  }
  

  // tick should be run once every frame to update physics, object locations and animations.
  tick() {
    // tick logic, animation etc happens here
    this.updateChunks();

    // draw new frame and call tick again with frameLimiter
    this.frameLimiter();
  }

  removeChunks(visibleChunks) {
    const now = Date.now();
    // go throuch each active chunk
    Object.keys(this.activeChunks).forEach((chunkID) => {
      // if it's not in the visible chunk, it's out of render range
      if (visibleChunks[chunkID] === undefined) {
        // remove the blocks in this chunk
        this.activeChunks[chunkID].forEach((block) => {
          this.scene.remove(block)
        });
        // remove this key from active chunks
        delete this.activeChunks[chunkID];
      }
    })
    // console.log('removing old chunks took:', Date.now() - now,'ms')
  }

  // get the location of chunks within the draw distance and draw them
  updateChunks() {
    // limite rate of chunk updates
    const now = Date.now();
    const interval = now - this.prevChunkUpdate;
    if (interval < this.chunkTickInterval) {
      return
    }

    this.prevChunkUpdate = now;

    // console.log('updating chunks');
    // get the centre point to calculate from
    const centerPoint = this.camera.position // (x, y, z)
    // console.log(centerPoint);
    const centerX = this.normalize(centerPoint.x, this.totalChunkSize) / this.totalChunkSize
    const centerZ = this.normalize(centerPoint.z, this.totalChunkSize) / this.totalChunkSize;

    const visibleChunks = {}; // will store all the chunks visible in this update

    // loop from -renderRange to renderRange (eg -4 to 4) for x and z to get chunks
    for (let x = this.renderRange * -1; x <= this.renderRange; x++) {
      for (let z = this.renderRange * -1; z <= this.renderRange; z++) {
        // global coordinates for this chunk
        const chunkX = centerX + x
        const chunkZ = centerZ + z
        const chunkID = `${chunkX},${chunkZ}`

        visibleChunks[chunkID] = true; //store this chunk id in an object for easy lookup

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
    const now = Date.now();
    const cx = x * this.chunkSize
    const cz = z * this.chunkSize;

    // initialise storage for this chunk
    const chunkID = `${x},${z}`;
    this.activeChunks[chunkID] = new Array(this.chunkBlocks);

    // console.log('origin of chunk:', cx, cz)
    // loop through the layer of chunk size
    let index = 0;
    for (let i = 0; i < this.chunkSize; i++) {
      for (let j = 0; j < this.chunkSize; j++) {
        // get noise for this grid square
        // +x and z to make it relative to this chunk
        const bx = i + cx;
        const bz = j + cz;
        
        // get the height of the terrain in normalized blocks
        const heightNoise = noise.simplex2(bx / this.widthMultiplier, bz / this.widthMultiplier)
        const height = Math.floor(heightNoise * this.heightMultiplier / this.blockSize) * this.blockSize
        
        const block = this.generateBlock(bx * this.blockSize, bz * this.blockSize, height)

        // store this blocks reference so we can remove it later
        this.activeChunks[chunkID][index++] = block;
      }
    }
    // console.log('generating individual chunk {', chunkID ,'} took:', Date.now() - now, "ms")
  }

  generateBlock(x, z, height) {
    const cubeMaterial = new THREE.MeshLambertMaterial({color: 'green'});
    const cubeGeom = new THREE.BoxGeometry(
      this.blockSize, this.blockSize, this.blockSize
    );

    const cube = new THREE.Mesh(cubeGeom, cubeMaterial);
    cube.castShadow = true;
    cube.receiveShadow = true;

    cube.position.set(x, height, z)

    this.scene.add(cube);
    return cube;
  }
}

const env = new MCEnvironment();
