import { box, cylinder, crystal } from './mesh.js';
import { visit, visible } from './tree.js';

const vertex = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec4 aX;
layout(location=3) in vec4 aY;
layout(location=4) in vec4 aZ;
layout(location=5) in vec4 aP;
layout(location=6) in vec4 aColor;
uniform vec3 uEye,uRight,uUp,uForward;
uniform vec2 uLens;
out vec3 vWorld,vNormal;
out vec4 vColor;
void main(){
  mat3 basis=mat3(aX.xyz,aY.xyz,aZ.xyz);
  vec3 world=basis*aPosition+aP.xyz;
  vec3 n=aNormal/max(vec3(dot(aX.xyz,aX.xyz),dot(aY.xyz,aY.xyz),dot(aZ.xyz,aZ.xyz)),vec3(.000001));
  vNormal=normalize(basis*n);vWorld=world;vColor=aColor;
  vec3 d=world-uEye;
  float z=dot(d,uForward);
  gl_Position=vec4(dot(d,uRight)/uLens.x,dot(d,uUp)/uLens.y,1.001112*z-.200112,z);
}`;
const fragment = `#version 300 es
precision highp float;
in vec3 vWorld,vNormal;
in vec4 vColor;
uniform vec3 uEye;
uniform float uTime,uGlow;
out vec4 outColor;
void main(){
  vec3 n=normalize(vNormal); if(!gl_FrontFacing)n=-n;
  float diffuse=max(dot(n,normalize(vec3(-.4,.9,.45))),0.);
  float back=max(dot(n,normalize(vec3(.6,.35,-.8))),0.);
  float rim=pow(1.-abs(dot(n,normalize(uEye-vWorld))),3.);
  vec3 shade=vColor.rgb*(vec3(.19,.29,.34)+diffuse*vec3(.78,.85,.83)+back*vec3(.2,.48,.51));
  shade+=rim*vec3(.07,.21,.23)+vColor.rgb*vColor.a;
  float fog=1.-exp(-max(length(vWorld-uEye)-18.,0.)*.022);
  shade=mix(shade,vec3(.047,.105,.132),fog);
  if(uGlow>.5){shade=vColor.rgb*(.65+vColor.a);outColor=vec4(shade,1.);}
  else{shade=shade/(shade+vec3(.65));outColor=vec4(pow(shade,vec3(.88)),1.);}
}`;
const skyVertex = `#version 300 es
precision highp float;
out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,.99999,1.);}`;
const skyFragment = `#version 300 es
precision highp float;
in vec2 uv;
uniform vec2 uSize;
uniform float uTime;
out vec4 outColor;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
void main(){
  vec2 p=uv;float aspect=uSize.x/uSize.y;
  vec3 c=mix(vec3(.024,.043,.067),vec3(.082,.191,.218),pow(1.-p.y,1.7));
  float cloud=noise(p*vec2(6.,14.)+vec2(uTime*.004,0.))*.5+noise(p*vec2(15.,35.))*.2;
  c+=vec3(.025,.057,.063)*cloud;
  vec2 sun=(p-vec2(.66,.73))*vec2(aspect,1.);
  float r=length(sun),a=atan(sun.y,sun.x);
  float corona=exp(-abs(r-.116)*90.)*.7+exp(-abs(r-.116)*23.)*.09;
  corona*=.8+.2*sin(a*39.+uTime*.15)*sin(a*17.-uTime*.12);
  c+=vec3(.52,.64,.48)*corona;
  c=mix(c,vec3(.027,.056,.071),1.-smoothstep(.109,.112,r));
  float edge=exp(-abs(r-.114)*1000.);c+=vec3(.7,.85,.64)*edge;
  vec2 stars=p*vec2(180.*aspect,180.);vec2 cell=floor(stars);
  float star=pow(max(0.,1.-length(fract(stars)-.5)*2.),12.);
  c+=vec3(.5,.78,.75)*star*step(.991,hash(cell))*smoothstep(.25,.7,p.y);
  for(int j=0;j<3;j++){
    float k=float(j);float h=.2+k*.055+noise(vec2(p.x*(9.+k*7.),k+5.))*(.09+k*.018);
    c=mix(c,vec3(.031+k*.008,.078+k*.012,.1+k*.012),1.-smoothstep(h-.006,h,p.y));
  }
  float vignette=smoothstep(.9,.25,length((p-.5)*vec2(1.,.85)));c*=.72+.28*vignette;
  c+=(hash(gl_FragCoord.xy+fract(uTime))-.5)*.006;
  outColor=vec4(c,1.);
}`;

function program(gl, vs, fs) {
  const shader = (type, source) => {
    const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s;
  };
  const p = gl.createProgram(), a = shader(gl.VERTEX_SHADER, vs), b = shader(gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p);
  gl.deleteShader(a); gl.deleteShader(b);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p));
  return p;
}

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: true, powerPreference: 'high-performance' });
    if (!gl) throw Error('This demo needs WebGL 2. Enable hardware acceleration or use a current desktop browser.');
    this.gl = gl; this.canvas = canvas; this.program = program(gl, vertex, fragment);
    this.sky = program(gl, skyVertex, skyFragment); this.meshes = new Map(); this.batches = new Map();
    this.addMesh('box', box()); this.addMesh('cylinder', cylinder(32));
    this.addMesh('hex', cylinder(6)); this.addMesh('cone', cylinder(7, 0));
    this.addMesh('crystal', crystal()); this.addMesh('rock', cylinder(7, .68));
    this.locations = {};
    for (const name of ['uEye','uRight','uUp','uForward','uLens','uTime','uGlow'])
      this.locations[name] = gl.getUniformLocation(this.program, name);
    this.skyTime = gl.getUniformLocation(this.sky, 'uTime');
    this.skySize = gl.getUniformLocation(this.sky, 'uSize');
    this.skyVAO = gl.createVertexArray();
    this.stats = { draws: 0, instances: 0, triangles: 0, culled: 0, visited: 0 };
  }
  addMesh(name, tree, dynamic = false) {
    const gl = this.gl, existing = this.meshes.get(name);
    const count = tree.count * 3, needed = count * 6;
    const data = existing?.data.length >= needed ? existing.data : new Float32Array(needed);
    let offset = 0;
    visit(tree, t => {
      const put = p => { data[offset++] = p.x; data[offset++] = p.y; data[offset++] = p.z;
        data[offset++] = t.normal.x; data[offset++] = t.normal.y; data[offset++] = t.normal.z; };
      put(t.a); put(t.b); put(t.c);
    });
    const buffer = existing?.buffer || gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    if (existing && existing.data === data) gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, needed);
    else gl.bufferData(gl.ARRAY_BUFFER, data, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    this.meshes.set(name, { buffer, count, data });
  }
  resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.6);
    const width = Math.round(this.canvas.clientWidth * ratio), height = Math.round(this.canvas.clientHeight * ratio);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width; this.canvas.height = height;
    }
    this.gl.viewport(0, 0, width, height);
  }
  append(item) {
    const key = item.mesh + (item.glow ? ':glow' : ':solid');
    let batch = this.batches.get(key);
    if (!batch) {
      const gl = this.gl, mesh = this.meshes.get(item.mesh);
      if (!mesh) throw Error(`Unknown mesh: ${item.mesh}`);
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
      const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      for (let location = 2; location <= 6; location++) {
        gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 4, gl.FLOAT, false, 80, (location - 2) * 16);
        gl.vertexAttribDivisor(location, 1);
      }
      batch = { vao, buffer, mesh: item.mesh, glow: item.glow, data: new Float32Array(20 * 64), count: 0, capacity: 0 };
      this.batches.set(key, batch);
    }
    if ((batch.count + 1) * 20 > batch.data.length) {
      const bigger = new Float32Array(batch.data.length * 2); bigger.set(batch.data); batch.data = bigger;
    }
    let i = batch.count++ * 20; const d = batch.data, m = item.transform, c = item.color;
    const put = (p, w) => { d[i++] = p.x; d[i++] = p.y; d[i++] = p.z; d[i++] = w; };
    put(m.x, 0); put(m.y, 0); put(m.z, 0); put(m.p, 1);
    d[i++] = c.r; d[i++] = c.g; d[i++] = c.b; d[i] = c.glow;
  }
  render(scene, dynamic, camera, time) {
    this.resize();
    const gl = this.gl, stats = this.stats;
    stats.draws = stats.instances = stats.triangles = stats.culled = stats.visited = 0;
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.sky); gl.bindVertexArray(this.skyVAO);
    gl.uniform2f(this.skySize, this.canvas.width, this.canvas.height); gl.uniform1f(this.skyTime, time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    for (const batch of this.batches.values()) batch.count = 0;
    visible(scene, camera.test, item => this.append(item), stats);
    visit(dynamic, item => this.append(item));
    gl.useProgram(this.program); gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    const vec = (name, p) => gl.uniform3f(this.locations[name], p.x, p.y, p.z);
    vec('uEye', camera.eye); vec('uRight', camera.right); vec('uUp', camera.up); vec('uForward', camera.forward);
    gl.uniform2f(this.locations.uLens, camera.tangent * camera.aspect, camera.tangent);
    gl.uniform1f(this.locations.uTime, time);
    const draw = glow => {
      for (const batch of this.batches.values()) {
        if (!batch.count || Boolean(batch.glow) !== glow) continue;
        gl.bindVertexArray(batch.vao); gl.bindBuffer(gl.ARRAY_BUFFER, batch.buffer);
        if (batch.capacity < batch.data.length) {
          gl.bufferData(gl.ARRAY_BUFFER, batch.data.byteLength, gl.DYNAMIC_DRAW); batch.capacity = batch.data.length;
        }
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, batch.data, 0, batch.count * 20);
        const mesh = this.meshes.get(batch.mesh);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, mesh.count, batch.count);
        stats.draws++; stats.instances += batch.count; stats.triangles += mesh.count / 3 * batch.count;
      }
    };
    gl.uniform1f(this.locations.uGlow, 0); draw(false);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    gl.uniform1f(this.locations.uGlow, 1); draw(true);
    gl.depthMask(true); gl.disable(gl.BLEND);
  }
}
