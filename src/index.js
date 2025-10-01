import * as dat from "dat.gui";
import { mat4 } from "gl-matrix";

// Vertex shader source
const vertexShaderSource = `#version 300 es
precision mediump float;

      in vec2 aCoordinates;
      uniform mat4 uModelMatrix;

      void main(void) {
        gl_Position = uModelMatrix * vec4(aCoordinates, 0.0, 1.0);
        gl_PointSize = 10.0;
      }
`;

// Fragment shader source
const fragmentShaderSource = `#version 300 es
precision mediump float;

out vec4 fragColor;
uniform vec4 uColor;

void main(void) {
  fragColor = uColor;
}
`;

// Global variables
var canvas, gl;
var colorLocation;
var vertex_buffer;
var modelMatrixLoc;
var modelMatrix;

// Simulation objects
var sun = {
  x: 0,
  y: 0,
  width: 0.2,
  height: 0.2,
  color: [1, 1, 0, 1],
};

var mercury = {
  x: 0.15,
  y: 0,
  width: 0.05,
  height: 0.05,
  color: [0.5, 0.5, 0.5, 1],
  angle: 0.0,
  rotationSpeed: 0.02,
  rotateX: 60.0,
  rotateY: 100.0,
}

var venus = {
  x: 0.3,
  y: 0,
  width: 0.1,
  height: 0.1,
  color: [1, 0.5, 0, 1],
  angle: 0.0,
  rotationSpeed: 0.008,
  rotateX: 40.0,
}

var moon = {
  x: 1.3,
  y: 0,
  width: 0.4,
  height: 0.4,
  color: [1, 1, 1, 1],
  angle: 0.0,
  rotationSpeed: 0.02,
};

var earth = {
  x: 0.6,
  y: 0,
  width: 0.1,
  height: 0.1,
  color: [0.2, 0.2, 1, 1],
  angle: 0.0,
  rotationSpeed: 0.01,
  satellites: [moon]
};

var fobos = {
  x: 1.3,
  y: 0,
  width: 0.4,
  height: 0.4,
  color: [1, 1, 0.75, 1],
  angle: 0.0,
  rotationSpeed: 0.03,
};

var mars = {
  x: 1,
  y: 0,
  width: 0.15,
  height: 0.15,
  color: [1, 0, 0, 1],
  angle: 0.0,
  rotationSpeed: 0.015,
  satellites: [fobos]
}

// Main objects array (non satellites)
var mainObjects = [sun, mercury, venus, earth, mars];

// GUI settings
var settings = {
  translateX: 0.0,
  translateY: 0.0,
  rotateX: 0.0,
  rotateY: 0.0,
  rotateZ: 0.0,
  zoom: 1,
  speed: 1,
};

// Model matrix stack
var matrixStack = [];

// Function to push matrices onto the stack
function glPushMatrix() {
  const matrix = mat4.create();
  mat4.copy(matrix, modelMatrix);
  matrixStack.push(matrix);
}

// Function to pop matrices off the stack
function glPopMatrix() {
  modelMatrix = matrixStack.pop();
}

function init() {
  // ============ STEP 1: Creating a canvas=================
  canvas = document.getElementById("my_Canvas");
  gl = canvas.getContext("webgl2");

  // create GUI
  var gui = new dat.GUI();
  gui.add(settings, "translateX", -1.0, 1.0, 0.01);
  gui.add(settings, "translateY", -1.0, 1.0, 0.01);
  gui.add(settings, "rotateX", -180, 180);
  gui.add(settings, "rotateY", -180, 180);
  gui.add(settings, "rotateZ", -180, 180);
  gui.add(settings, "zoom", 0.5, 2.0);
  gui.add(settings, "speed", 0.1, 2.0);
  gui.add({ reset: () => {
    settings.translateX = 0.0;
    settings.translateY = 0.0;
    settings.rotateX = 0.0;
    settings.rotateY = 0.0;
    settings.rotateZ = 0.0;
    settings.zoom = 1;
    settings.speed = 1;
    gui.updateDisplay();
  }}, "reset");

  // Posicionar el GUI debajo del canvas
  const canvasRect = canvas.getBoundingClientRect();
  gui.domElement.style.position = "absolute";
  gui.domElement.style.top = canvasRect.bottom + window.scrollY + 20 + "px";
  gui.domElement.style.left =
    canvasRect.left +
    window.scrollX +
    (canvasRect.width - gui.domElement.offsetWidth) / 2 +
    "px";

  //========== STEP 2: Create and compile shaders ==========

  // Create a vertex shader object
  const vertShader = gl.createShader(gl.VERTEX_SHADER);

  // Attach vertex shader source code
  gl.shaderSource(vertShader, vertexShaderSource);

  // Compile the vertex shader
  gl.compileShader(vertShader);
  if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
    console.log("vertShader: " + gl.getShaderInfoLog(vertShader));
  }

  // Create fragment shader object
  const fragShader = gl.createShader(gl.FRAGMENT_SHADER);

  // Attach fragment shader source code
  gl.shaderSource(fragShader, fragmentShaderSource);

  // Compile the fragmentt shader
  gl.compileShader(fragShader);
  if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
    console.log("fragShader: " + gl.getShaderInfoLog(fragShader));
  }

  // Create a shader program object to store
  // the combined shader program
  const shaderProgram = gl.createProgram();

  // Attach a vertex shader
  gl.attachShader(shaderProgram, vertShader);

  // Attach a fragment shader
  gl.attachShader(shaderProgram, fragShader);

  // Link both programs
  gl.linkProgram(shaderProgram);

  // Use the combined shader program object
  gl.useProgram(shaderProgram);

  //======== STEP 3: Create buffer objects and associate shaders ========

  // Create an empty buffer object to store the vertex buffer
  vertex_buffer = gl.createBuffer();

  // Bind vertex buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);

  // Get the attribute location
  const coordLocation = gl.getAttribLocation(shaderProgram, "aCoordinates");

  // Point an attribute to the currently bound VBO
  gl.vertexAttribPointer(coordLocation, 2, gl.FLOAT, false, 0, 0);

  // Enable the attribute
  gl.enableVertexAttribArray(coordLocation);

  // Unbind the buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // look up uniform locations
  colorLocation = gl.getUniformLocation(shaderProgram, "uColor");
  modelMatrixLoc = gl.getUniformLocation(shaderProgram, "uModelMatrix");
}

function render() {
  //========= STEP 4: Create the geometry and draw ===============

  // Clear the canvas
  gl.clearColor(0.2, 0.2, 0.3, 1.0);

  // Clear the color buffer bit
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Set the view port
  gl.viewport(0, 0, canvas.width, canvas.height);

  // Bind appropriate array buffer to it
  gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);

  // Set the model Matrix.
  modelMatrix = mat4.create();
  mat4.identity(modelMatrix);
  mat4.translate(modelMatrix, modelMatrix, [
    settings.translateX,
    settings.translateY,
    0,
  ]);
  mat4.rotateX(modelMatrix, modelMatrix, (settings.rotateX / 180) * Math.PI);
  mat4.rotateY(modelMatrix, modelMatrix, (settings.rotateY / 180) * Math.PI);
  mat4.rotateZ(modelMatrix, modelMatrix, (settings.rotateZ / 180) * Math.PI);
  mat4.scale(modelMatrix, modelMatrix, [settings.zoom, settings.zoom, 1]);
  gl.uniformMatrix4fv(modelMatrixLoc, false, modelMatrix);

  // Draw all objects
  for (let i = 0; i < mainObjects.length; i++) {
    drawObject(mainObjects[i], modelMatrix);
    if (i > 0) {
      // Draw orbit for all objects except the sun
      drawOrbit(mainObjects[i], modelMatrix);
      if (mainObjects[i].satellites !== undefined) {
        for (let j = 0; j < mainObjects[i].satellites.length; j++) {
          drawSatelliteOrbit(mainObjects[i].satellites[j], mainObjects[i], modelMatrix);
        }
      }
    }
  }

  // Unbind the buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // Start animation loop
  window.requestAnimationFrame(render);
}

// Function to draw a square
function drawSquare() {
  const v = new Float32Array([
    -0.5, 0.5, 0.5, 0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, 0.5, -0.5,
  ]);
  // Pass the vertex data to the buffer
  gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

// Function to draw an object and its satellites
function drawObject(obj, modelMatrix) {
  glPushMatrix();
  if (obj.rotateX !== undefined) {
    mat4.rotateX(modelMatrix, modelMatrix, (obj.rotateX / 180) * Math.PI);
  }

  if (obj.rotateY !== undefined) {
    mat4.rotateY(modelMatrix, modelMatrix, (obj.rotateY / 180) * Math.PI);
  }

  if (obj.angle !== undefined) {
    obj.angle += obj.rotationSpeed * settings.speed;
    mat4.rotateZ(modelMatrix, modelMatrix, obj.angle);
  }

  mat4.translate(modelMatrix, modelMatrix, [obj.x, obj.y, 0]);
  mat4.scale(modelMatrix, modelMatrix, [obj.width, obj.height, 1]);
  gl.uniformMatrix4fv(modelMatrixLoc, false, modelMatrix);
  gl.uniform4fv(colorLocation, obj.color);
  drawSquare();

  if (obj.satellites !== undefined) {
    for (let i = 0; i < obj.satellites.length; i++) {
      drawObject(obj.satellites[i], modelMatrix);
    }
  }
  glPopMatrix();
}

// Function to draw a circle
function drawCircle() {
  const numSegments = 100;
  const angleStep = (2 * Math.PI) / numSegments;
  const vertices = [];

  for (let i = 0; i <= numSegments; i++) {
    const angle = i * angleStep;
    const x = 1 * Math.cos(angle);
    const y = 1 * Math.sin(angle);
    vertices.push(x, y);
  }

  const v = new Float32Array(vertices);
  // Pass the vertex data to the buffer
  gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
  gl.drawArrays(gl.LINE_LOOP, 0, numSegments + 1);
}

// Function to draw the orbit of a planet
function drawOrbit(obj, modelMatrix) {
  glPushMatrix();

  if (obj.rotateX !== undefined) {
    mat4.rotateX(modelMatrix, modelMatrix, (obj.rotateX / 180) * Math.PI);
  }

  if (obj.rotateY !== undefined) {
    mat4.rotateY(modelMatrix, modelMatrix, (obj.rotateY / 180) * Math.PI);
  }

  mat4.scale(modelMatrix, modelMatrix, [obj.x, obj.x, 1]);
  gl.uniformMatrix4fv(modelMatrixLoc, false, modelMatrix);
  gl.uniform4fv(colorLocation, obj.color);
  drawCircle();

  glPopMatrix();
}

// Function to draw the orbit of a satellite around its parent object
function drawSatelliteOrbit(satellite, parentObj, modelMatrix) {
  glPushMatrix();

  mat4.rotateZ(modelMatrix, modelMatrix, parentObj.angle);
  mat4.translate(modelMatrix, modelMatrix, [parentObj.x, parentObj.y, 0]);
  mat4.scale(modelMatrix, modelMatrix, [parentObj.width, parentObj.height, 1]);
  mat4.scale(modelMatrix, modelMatrix, [satellite.x, satellite.x, 1]);
  gl.uniformMatrix4fv(modelMatrixLoc, false, modelMatrix);
  gl.uniform4fv(colorLocation, satellite.color);
  drawCircle();

  glPopMatrix();
}

// CÓDIGO PRINCIPAL
init();
render();
