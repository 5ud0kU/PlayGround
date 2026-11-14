import * as THREE from './vendor/three.module.js';

// Elsewhere County is a self-contained, no-assets-needed walking adventure.
const scene=new THREE.Scene();scene.background=new THREE.Color(0x9caeaa);scene.fog=new THREE.Fog(0x9caeaa,65,215);
const camera=new THREE.PerspectiveCamera(67,innerWidth/innerHeight,.1,260);camera.rotation.order='YXZ';
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;document.querySelector('#scene').appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xe4f0e2,0x697467,1.8));const sun=new THREE.DirectionalLight(0xffe6be,2.4);sun.position.set(-45,70,-35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-115;sun.shadow.camera.right=115;sun.shadow.camera.top=105;sun.shadow.camera.bottom=-105;sun.shadow.bias=-.00025;scene.add(sun);
const mat=(c,r=.88)=>new THREE.MeshStandardMaterial({color:c,roughness:r});const grass=mat(0x849875),road=mat(0x777b70),pavement=mat(0xb8b19a),water=mat(0x719b9d,.35),white=mat(0xf0e9d7),dark=mat(0x303d3a),wood=mat(0x765844);
function box(parent,x,y,z,w,h,d,m,shadow=true){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=shadow;o.receiveShadow=true;parent.add(o);return o}function cyl(parent,x,y,z,r1,r2,h,m,n=10){let o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,n),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
// County ground, creek, bridges, roads, painted center dashes.
box(scene,0,-.7,0,230,1.4,200,grass);box(scene,0,-.08,-92,235,.16,10,water,false);box(scene,0,.03,-86,235,.22,2,pavement);
const roadXs=[-88,-58,-28,2,32,62,92],roadZs=[-72,-42,-12,18,48,78];
for(const x of roadXs){box(scene,x,.015,0,7,.08,178,road);for(let z=-82;z<85;z+=9)box(scene,x,.065,z,.13,.025,3.2,mat(0xd9d3bb),false);box(scene,x+4,.08,0,1.2,.15,176,pavement,false)}
for(const z of roadZs){box(scene,0,.02,z,212,.08,6.5,road);for(let x=-100;x<103;x+=9)box(scene,x,.07,z,.13,.025,2.7,mat(0xd9d3bb),false);box(scene,0,.08,z+3.8,210,.15,1.1,pavement,false)}
// A small river bend and country lanes past the edge of town.
const creek=box(scene,-102,-.04,23,9,.12,154,water,false);creek.rotation.y=-.12;box(scene,-96,.06,22,1.8,.22,148,pavement,false);
for(let x of [-92,-62,-32,-2,28,58,88]){for(let z of [-71,-41,-11,19,49,79]){if(Math.abs(x)<8&&Math.abs(z)<18)continue;for(let s of [-1,1])box(scene,x+s*5,.08,z+s*4,1.5,.15,1.4,pavement,false)}}
// Landmark directory: every entry is a distinct, walk-up discovery.
const sites=[
 {name:'Juniper Row',type:'Residential neighborhood',icon:'⌂',x:-75,z:-56,color:0xb78968,w:13,d:9,h:6,note:'A close-knit run of porch-front homes. The paper carrier still knows every dog by name.'},
 {name:'Pine Court',type:'Apartment complex',icon:'▤',x:-43,z:-45,color:0xb7aa86,w:15,d:11,h:13,note:'Three floors, twelve little balconies, and an old rotary phone by the lobby door.'},
 {name:'The Miller House',type:'Private house',icon:'⌂',x:-88,z:-17,color:0xc4916b,w:9,d:8,h:6,note:'A pale blue place at the bend. Wind chimes answer the creek on still afternoons.'},
 {name:'Elsewhere High',type:'School & university',icon:'✎',x:-43,z:-5,color:0xb0a074,w:18,d:12,h:9,note:'The bell tower stopped at 3:10 years ago. A hand-painted mural faces the playing field.'},
 {name:'County General',type:'Hospital & psychiatric care',icon:'✚',x:-4,z:-54,color:0xc2c3ad,w:18,d:12,h:11,note:'A warm light stays on in the old east wing, even when the rest of the hospital sleeps.'},
 {name:'Stillwater Clinic',type:'Psychiatric facility',icon:'✚',x:34,z:-54,color:0xa8b5a4,w:15,d:11,h:8,note:'Quiet gardens, a locked archive, and a weather vane shaped like a swallow.'},
 {name:'Sheriff Station 4',type:'Police station',icon:'★',x:75,z:-58,color:0x9ba9a5,w:13,d:10,h:7,note:'The dispatch radio hums with weather reports and stories from the night shift.'},
 {name:'Engine House',type:'Fire department',icon:'♨',x:78,z:-27,color:0xb7654e,w:14,d:11,h:8,note:'The brass pole is polished; the old red engine has not left the bay in a decade.'},
 {name:'Cedar Plaza',type:'Shopping center',icon:'▦',x:-75,z:9,color:0x98856e,w:17,d:12,h:7,note:'A fading strip mall with sun-bleached awnings and a fountain full of pennies.'},
 {name:'Market & Sons',type:'Grocery store',icon:'▧',x:-43,z:31,color:0xa1ad7b,w:13,d:10,h:6,note:'Open since 1958. The chalkboard out front still lists peaches at 40 cents a pound.'},
 {name:'The Lantern',type:'Restaurant & bar',icon:'✦',x:-4,z:31,color:0xb87558,w:12,d:10,h:6,note:'A tiny supper club. Its neon lantern flickers on at dusk, whether anyone is there or not.'},
 {name:'Motel Solstice',type:'Hotel & motel',icon:'▰',x:34,z:31,color:0xb99c75,w:16,d:11,h:8,note:'Room 8 has been reserved every summer for the same name since the county records began.'},
 {name:'St. Oran’s',type:'Church & religious institution',icon:'✝',x:75,z:9,color:0xd0c7a9,w:13,d:12,h:13,note:'A small stone chapel, its bell tower visible from every road in the county.'},
 {name:'Hollow Hill Cemetery',type:'Cemetery',icon:'†',x:91,z:35,color:0x929981,w:12,d:12,h:5,note:'The oldest headstone predates the town. Someone leaves fresh wildflowers there each week.'},
 {name:'Northline Works',type:'Industrial facility',icon:'⚙',x:75,z:61,color:0x8e9990,w:18,d:13,h:11,note:'A disused rail spur vanishes beneath the loading dock. The night watchman never discusses it.'},
 {name:'Paper Mill No. 2',type:'Factory',icon:'⚒',x:34,z:67,color:0x9d8c71,w:17,d:13,h:12,note:'The smokestack is cold now. Its clock face still keeps perfect time.'},
 {name:'County Library',type:'Library',icon:'▤',x:-4,z:63,color:0xb9a57e,w:15,d:11,h:8,note:'The basement index has a drawer labeled “places that are no longer here.”'},
 {name:'Old Courthouse',type:'Government building',icon:'⚖',x:-43,z:67,color:0xb7b19c,w:16,d:12,h:10,note:'A copper dome gone green. In the lobby, a map shows a road that no longer exists.'},
 {name:'Drain 9',type:'Underground tunnels & sewers',icon:'≋',x:3,z:-16,color:0x687b75,w:10,d:8,h:4,note:'A storm drain descends into a brick-lined tunnel. Deep below, water flows uphill.'},
 {name:'Blackpine & the Annex',type:'Forest, countryside & secret facility',icon:'✧',x:-95,z:72,color:0x536e59,w:13,d:11,h:7,note:'Beyond the pines: an abandoned service station and a sealed concrete door with no handle.'}
];
const walls=[];const roofM=[0x67564b,0x625e51,0x566865,0x78594b,0x586354].map(c=>mat(c));const signMat=mat(0xd8c493);const windowMat=new THREE.MeshStandardMaterial({color:0x6e9995,roughness:.34,metalness:.1,emissive:0x344442,emissiveIntensity:.12});
function building(site,i){const {x,z,w,d,h,color}=site,g=new THREE.Group();g.position.set(x,0,z);scene.add(g);let wall=mat(color),trim=mat(0xe0d5bd),roof=roofM[i%roofM.length];box(g,0,h/2,0,w,h,d,wall);box(g,0,h+.1,0,w+.7,.35,d+.7,roof);
 // stepped parapet / roof details, windows and a centered welcoming entrance
 if(i%3!==1){const r1=box(g,0,h+.42,0,w*.7,.42,d*.72,roof);r1.rotation.z=(i%2?.13:-.13)}
 let floors=Math.max(1,Math.floor(h/3));for(let f=0;f<floors;f++){let wy=1.65+f*2.65;if(wy>h-.5)continue;let count=Math.max(2,Math.floor(w/2.6));for(let j=0;j<count;j++){let wx=(j-(count-1)/2)*(w/(count+.3));if(f===0&&Math.abs(wx)<1.45)continue;box(g,wx,wy,d/2+.025,1.05,1.05,.07,windowMat,false);box(g,wx,wy,d/2+.075,.07,1.14,.06,trim,false);box(g,wx,wy,d/2+.075,1.15,.07,.06,trim,false);box(g,wx,wy+.03,d/2+.11,.045,1,.04,trim,false)}}
 box(g,0,1.05,d/2+.07,1.25,2.1,.14,wood);box(g,.33,1.1,d/2+.16,.08,.08,.04,signMat,false);
 // A legible hanging sign, with a warm marker light above the porch.
 box(g,0,h*.66,d/2+.17,Math.min(w*.74,8),.64,.18,signMat,false);box(g,0,h*.66+.02,d/2+.275,Math.min(w*.67,7.5),.44,.05,mat(color),false);box(g,0,h*.66+.02,d/2+.31,.055,.26,.025,mat(0xf0d89d),false);
 box(g,-w*.31,.22,d/2+.9,.7,.42,.55,mat(i%2?0x627c5e:0x9c7658));
 walls.push({x,z,w:w+.4,d:d+.5});
 // Unique silhouettes and props make public buildings easy to recognize.
 if(site.type.includes('Church')){const tower=box(g,-w*.3,h+.85,-d*.15,2.3,4.2,2.3,wall);cyl(g,-w*.3,h+3.25,-d*.15,.06,.06,1.8,trim,8);const sp=new THREE.Mesh(new THREE.ConeGeometry(1.7,2.6,4),roof);sp.position.set(-w*.3,h+4.25,-d*.15);sp.rotation.y=Math.PI/4;g.add(sp)}
 if(site.type==='School & university'||site.type.includes('Government')){cyl(g,0,h+1.9,-d*.22,.08,.08,3.4,trim,8);box(g,.7,h+2.6,-d*.22,1.3,.75,.05,mat(0xb65948),false)}
 if(site.type.includes('Factory')||site.type.includes('Industrial')){cyl(g,w*.27,h+2,-d*.25,.9,.72,4,mat(0x665f50),12);cyl(g,w*.27,h+4.1,-d*.25,.94,.94,.22,mat(0x4d5147),12);box(g,-w*.22,h+.65,-d*.1,3.5,1.3,3,mat(0x77796f))}
 if(site.type==='Cemetery'){for(let a=-1;a<=1;a++)for(let b=0;b<3;b++){let stone=box(g,a*2,.55,-2+b*2.1,.65,1.1,.22,mat(0xd0cbb2));stone.rotation.z=a*.09}for(let s of [-1,1])box(g,s*w*.42,.65,0,.18,1.3,d,wood)}
 if(site.type.includes('tunnels')){cyl(g,0,2.6,d*.38,1.65,1.65,.3,mat(0x66746e),16);const mouth=new THREE.Mesh(new THREE.CircleGeometry(1.18,20),dark);mouth.position.set(0,1.95,d*.38+.04);g.add(mouth);box(g,0,3.4,d*.38,3.8,.18,.35,mat(0x7d8170))}
 if(site.name.includes('Blackpine')){box(g,0,1.8,-d*.3,w*.8,3.6,d*.42,mat(0x62645c));for(let k=-1;k<=1;k++){box(g,k*3,1.5,d*.03,.25,3,.32,mat(0x404b47));box(g,k*3,3,d*.03,1.5,.22,.35,mat(0x404b47))}}
 return g}
sites.forEach((s,i)=>building(s,i));
// Outlying cottages, orchard rows and the deep pine belt make the county feel lived-in.
let rng=7531;function rand(){rng=(rng*1664525+1013904223)>>>0;return rng/4294967296}
const trunk=mat(0x685842),leafMats=[mat(0x496a50),mat(0x5d7954),mat(0x71835a),mat(0x829065)];
function tree(x,z,s=1){cyl(scene,x,.9*s,z,.17*s,.25*s,1.8*s,trunk,8);for(let n=0;n<3;n++){const crown=new THREE.Mesh(new THREE.IcosahedronGeometry((1.05-n*.13)*s,1),leafMats[Math.floor(rand()*leafMats.length)]);crown.position.set(x+(rand()-.5)*.8*s,2.1*s+n*.44*s,z+(rand()-.5)*.65*s);crown.castShadow=true;crown.receiveShadow=true;scene.add(crown)}}
function lamppost(x,z){cyl(scene,x,1.7,z,.07,.1,3.3,mat(0x4b5750),8);box(scene,x,3.35,z,.48,.12,.48,mat(0x4b5750));const bulb=new THREE.Mesh(new THREE.SphereGeometry(.14,8,7),new THREE.MeshStandardMaterial({color:0xffe6aa,emissive:0xffc15c,emissiveIntensity:.7}));bulb.position.set(x,3.25,z);scene.add(bulb)}
// Side streets receive small lamps, benches and hedgerows.
for(let x of [-84,-54,-24,6,36,66,96])for(let z=-68;z<=78;z+=30)lamppost(x+(x<0?-5:5),z+4);
for(let i=0;i<48;i++){let x=-108+rand()*216,z=-82+rand()*160;if(Math.abs(x%30)<5||Math.abs(z%30)<5)continue;let close=sites.some(s=>Math.abs(x-s.x)<12&&Math.abs(z-s.z)<12);if(!close)tree(x,z,.65+rand()*.55)}
// A small orchard at the edge of town; the west ridge is dense, quiet pine forest.
for(let x=-106;x<-82;x+=5)for(let z=-78;z<85;z+=6)if(rand()>.16)tree(x+(rand()-.5)*3,z+(rand()-.5)*3,.85+rand()*.7);
for(let x=-75;x<-48;x+=7)for(let z=59;z<86;z+=7)tree(x, z,.65+rand()*.28);
// Yard fences and tiny cottages complete the residential streets without blocking roads.
const cottageColors=[0xb68b68,0x899f8e,0xc0ad83,0x9e766d,0x82969b].map(c=>mat(c));
for(let i=0;i<23;i++){let x=-82+rand()*164,z=-72+rand()*144;if(Math.abs(x%30)<8||Math.abs(z%30)<8)continue;if(sites.some(s=>Math.abs(x-s.x)<13&&Math.abs(z-s.z)<13))continue;let w=4.2+rand()*2.2,d=4+rand()*2,h=3.5+rand()*1;box(scene,x,h/2,z,w,h,d,cottageColors[i%cottageColors.length]);box(scene,x,h+.2,z,w+.45,.35,d+.45,roofM[i%5]);box(scene,x,1.7,z+d/2+.03,.63,1.05,.05,windowMat,false);walls.push({x,z,w:w+.4,d:d+.5})}
// County signposts with reflective enamel plates.
for(const [x,z,label] of [[-58,-42,'JUNIPER ROW'],[-28,-12,'CIVIC SQUARE'],[32,18,'OLD MAIN'],[62,48,'NORTHLINE']]){cyl(scene,x,1.4,z,.07,.09,2.8,wood,8);box(scene,x,2.45,z,.2,.9,.16,signMat);box(scene,x,2.45,z+.1,1.8,.52,.05,mat(0x425e50),false)}
// The rendered county is shared with the autonomous town simulation.
import { startTown } from './town.js';
startTown({THREE,scene,camera,renderer,sites,walls,mat,box,cyl,grass,road,pavement,water,white,dark,wood});
