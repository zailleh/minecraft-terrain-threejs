# Generate Minecraft-like terrain with THREE.js
## About
This was build as a demo to show students the basic logic behind generating 'voxel' terrain, as seen in Mincecraft.

### See an Example of the end product at http://timcaldwell.solutions/minecraft-terrain-threejs/

## To start a blank project
Run these commands
``` sh
mkdir minecraft-threejs
cd minecraft-threejs

# HTML
curl -L https://bit.ly/2Mp1ipf > index.html

# JavaScript
mkdir js
curl -L https://bit.ly/2whQPkK > js/main.js
curl -L https://bit.ly/1PcHlZ0 > js/three.js
curl -L https://bit.ly/20Dwrme > js/orbitControls.js
curl -L https://bit.ly/2MmWaSy > js/perlin.js

# Textures
mkdir res
curl -L https://i.imgur.com/fzWAFte.jpg > res/side.jpg
curl -L https://i.imgur.com/0QFMWz3.jpg > res/top.jpg
curl -L https://i.imgur.com/O0kBsZm.jpg > res/bottom.jpg

# temporary alias to run ruby http server needed for textures to load properly
alias rubyserv='ruby -run -e httpd . -p 8080'
```
