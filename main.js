import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const light = new THREE.AmbientLight( 0xffffff ); // soft white light
scene.add( light );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
const viewer = document.getElementById('canvas_viewer');
viewer.appendChild( renderer.domElement );

camera.position.z = 5;

const loader = new GLTFLoader();
let meshObj;
let mouseDown = false;
let eraseMode = false;
const eraseMessage = document.getElementById('erase_mode');

loader.load( './2011HondaOdysseyScan1.glb', function ( gltf ) {
    meshObj = gltf.scene.children[0];
	scene.add( meshObj );

}, undefined, function ( error ) {

	console.error( error );

} );

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

window.addEventListener( 'pointermove', onPointerMove );
function onPointerMove( event ) {

	// calculate pointer position in normalized device coordinates
	// (-1 to +1) for both components

	pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
    

}

viewer.addEventListener('mousedown', () => documentMouseDown());
viewer.addEventListener('mousemove', (e) => documentMouseMove(e));
viewer.addEventListener('mouseup', () => documentMouseUp());
document.body.addEventListener('keydown', (e) => documentKeyDown(e));
function documentMouseDown() {
    mouseDown = true;
}
function documentMouseMove(e) {
    if (mouseDown && !eraseMode) {
        meshObj.rotation.y += (e.movementX) / 100;
        meshObj.rotation.x += (e.movementY) / 100;
    } else if (mouseDown && eraseMode) {
        window.requestAnimationFrame(render);
    }
}
function documentMouseUp() {
    mouseDown = false;
}
function documentKeyDown(e) {
    if (e.key === 'e' || e.key === 'E') {
        eraseMode = !eraseMode;
        toggleEraseMessage();
    }
}

function toggleEraseMessage() {
    if (eraseMessage.style.display == 'none') {
        eraseMessage.style.display = 'block';
    } else {
        eraseMessage.style.display = 'none';
    }
}

function animate() {
	requestAnimationFrame( animate );
	renderer.render( scene, camera );
}
animate();






function render() {

	// update the picking ray with the camera and pointer position
	raycaster.setFromCamera( pointer, camera );

	// calculate objects intersecting the picking ray
    console.log(scene.children)
	const intersects = raycaster.intersectObjects( scene.children );
	for ( let i = 0; i < intersects.length; i ++ ) {
        // console.log(intersects[i])
        let faceIndex = intersects[i].faceIndex;
        console.log(faceIndex);
        meshObj.geometry.index.array.splice(3 * faceIndex, 3);
        // meshObj.faces.splice(intersects[i].faceIndex, 1);
		// intersects[ i ].object.material.color.set( 0xff0000 );

	}

	renderer.render( scene, camera );

}

