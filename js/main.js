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
    this.heightMultiplier = 20; // increases the 'amplitude' of the noise
    this.widthMultiplier = 20; // smooths the noise
    this.totalChunkSize = this.chunkSize * this.blockSize;
    this.renderRange = 1 // render chunks in a radius of 4 chunks

    // tell document to start rendinering when it's ready.
    document.addEventListener("DOMContentLoaded", () => this.init() );
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
    this.renderChunks();

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

  // get the location of chunks within the draw distance and draw them
  renderChunks() {
    // get the centre point to calculate from
    const centerPoint = this.camera.position // (x, y, z)
    console.log(centerPoint);
    const centerX = this.normalize(centerPoint.x, this.totalChunkSize) / this.chunkSize
    const centerZ = this.normalize(centerPoint.z, this.totalChunkSize) / this.chunkSize;

    // loop from -renderRange to renderRange (eg -4 to 4) for x and z to get chunks
    for(let x = this.renderRange * -1; x <= this.renderRange; x++) {
      for (let z = this.renderRange * -1; z <= this.renderRange; z++) {
        // global coordinates for this chunk
        const chunkX = centerX + x
        const chunkZ = centerZ + z
        
        // TODO: only create a chunk if it's not already created
        // render it
        this.generateChunk(chunkX, chunkZ);
      }
    }
  }

  // tick should be run once every frame to update physics, object locations and animations.
  tick() {
    // tick logic, animation etc happens here


    // draw new frame and call tick again
    this.updateFrame();
    
    requestAnimationFrame(() => this.tick());
  }

  // this will generate the surface layer for the chunk
  generateChunk(x = 0 ,y = 0) {
    const cx = x * this.chunkSize
    const cy = y * this.chunkSize;
    // console.log('origin of chunk:', cx, cy)
    // loop through the layer of chunk size
    for (let i = 0; i < this.chunkSize; i++) {
      for (let j = 0; j < this.chunkSize; j++) {
        // get noise for this grid square
        // +x and y to make it relative to this chunk
        const bx = i + cx;
        const by = j + cy;
        

        const height = Math.floor(noise.simplex2(bx / this.widthMultiplier, by / this.widthMultiplier ) * this.heightMultiplier / this.blockSize) * this.blockSize
        console.log(height)
        this.makeCube(bx*this.blockSize, by*this.blockSize, height);
      }
    }
  }

  makeCube(x, z, height) {
    const cubeMaterial = new THREE.MeshLambertMaterial({color: 'green'});
    const cubeGeom = new THREE.BoxGeometry(
      this.blockSize, this.blockSize, this.blockSize
    );

    const cube = new THREE.Mesh(cubeGeom, cubeMaterial);
    cube.castShadow = true;
    cube.receiveShadow = true;

    cube.position.set(x, height, z)

    this.scene.add(cube);
  }
}

const env = new MCEnvironment();
