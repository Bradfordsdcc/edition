/* ============================================================
   edition-icons.js
   Eight animated category icons for the Edition site.

   Markup Webflow produces per Collection Item:
     <canvas class="edi-icon" data-category="fabrication"></canvas>

   Category slugs:
     fabrication · hand-skills · digital-skills · professional-skills
     talks · social · culture · field-trip

   Load edition-palette.js FIRST. This file listens for the
   'edition:palette' event and repaints on a palette change.
   ============================================================ */
(function(){
'use strict';
var Edition = window.Edition = window.Edition || {};


var CUR={ink:"#141210",paper:"#F2EEE3"};
function h1(n){var x=Math.sin(n*127.1)*43758.5453;return x-Math.floor(x);}
function h2(a,b){var x=Math.sin(a*127.1+b*311.7)*43758.5453;return x-Math.floor(x);}
function clearL(ctx){
  ctx.fillStyle=CUR.paper;ctx.fillRect(-3,-3,106,106);
  ctx.strokeStyle=CUR.ink;ctx.fillStyle=CUR.ink;
  ctx.globalAlpha=1;ctx.lineWidth=0.5;ctx.lineCap='round';ctx.lineJoin='round';}
function S(ctx,a,w){
  ctx.globalAlpha=a;
  /* CUR.sw keeps a given weight the same physical thickness whatever
     size the icon is displayed at */
  ctx.lineWidth=w*(CUR.sw||1);
  ctx.strokeStyle=CUR.ink;}
function seg(ctx,x0,y0,x1,y1){ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();}

function icoFacet(ctx,t,p){
  clearL(ctx);
  var N=p.slices, V=p.sides;
  var Z=p.zoom*0.01;
  var spin=t*p.spin*0.0004, morph=t*p.morph*0.0005;
  var scroll=(t*p.drift*0.001)%1;
  var rings=[];
  for(var i=0;i<=N;i++){
    var u=(i+scroll)/N;
    var yb=6+u*88;
    var open=Math.sin(u*Math.PI);
    var ring=[];
    for(var k=0;k<V;k++){
      var a=k/V*Math.PI*2+spin+u*p.twist*0.01;
      var r=p.radius*open*(1
        +0.30*Math.sin(k*2.3+u*5+morph*2)
        +0.16*Math.sin(k*1.1-u*7+morph*3));
      var px=50+Math.cos(a)*r;
      var py=yb+Math.sin(a)*r*p.squash*0.01;
      ring.push([50+(px-50)*Z,50+(py-50)*Z]);}
    rings.push(ring);}
  /* draw far to near, filling so nearer sections occlude */
  for(var i2=rings.length-1;i2>=0;i2--){
    var R=rings[i2];
    ctx.beginPath();
    R.forEach(function(q,k){k?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]);});
    ctx.closePath();
    if(p.solid>0){ctx.globalAlpha=1;ctx.fillStyle=CUR.paper;ctx.fill();}
    S(ctx,0.35+0.55*Math.sin((i2/N)*Math.PI),p.weight*0.1);
    ctx.stroke();
    /* longitudinal edges between sections make it read as a solid */
    if(p.edges>0&&i2<rings.length-1){
      var Rn=rings[i2+1];
      S(ctx,0.28,p.weight*0.1*0.75);
      ctx.beginPath();
      for(var k2=0;k2<V;k2+=p.edgeEvery){
        ctx.moveTo(R[k2][0],R[k2][1]);ctx.lineTo(Rn[k2][0],Rn[k2][1]);}
      ctx.stroke();}}
  ctx.globalAlpha=1;
}
function icoLineGradient(ctx,t,p){
  clearL(ctx);
  var s=t*p.speed*0.0001, k=p.scale*0.01;
  var sp=p.spacing*0.1;
  var stepx=p.res*0.1;
  for(var y=-2;y<106;y+=sp){
    var wob=p.waver>0?Math.sin(y*0.13+s*4)*p.waver*0.1:0;
    var started=false;
    for(var x=-3;x<=103;x+=stepx){
      var yy=y+wob*Math.sin(x*0.06+s*3);
      var g=0.5
        +0.30*Math.sin((x+yy)*k*0.75+s*5.1)
        +0.20*Math.sin(x*k*1.10-s*7.0)
        +0.14*Math.sin(yy*k*1.50+s*4.1)
        +0.10*Math.sin((x-yy)*k*1.30-s*8.6);
      g=Math.max(0,Math.min(1,0.5+(g-0.5)*(p.contrast*0.01)));
      if(g<p.floorv*0.01){started=false;continue;}
      /* opacity 100 = fully opaque strokes, tone carried by weight alone */
      var ga=(p.opacity===undefined?70:p.opacity)*0.01;
      S(ctx,Math.min(1,(0.25+g*0.75)*ga+(ga>0.99?0.25:0)),
        (p.minw+g*p.maxw)*0.05);
      if(!started){ctx.beginPath();ctx.moveTo(x,yy);started=true;}
      else{ctx.lineTo(x,yy);ctx.stroke();ctx.beginPath();ctx.moveTo(x,yy);}}}
  ctx.globalAlpha=1;
}
function icoLineRain(ctx,t,p){
  clearL(ctx);
  var COLS=p.cols;
  var CW=104/COLS;
  for(var c=0;c<COLS;c++){
    var seed=h1(c*3.7);
    var spd=(p.smin+seed*(p.smax-p.smin))*0.01;
    var span=140;
    var cyc=Math.floor((t*spd+seed*300)/span);
    var head=(t*spd+seed*300)-cyc*span-20;
    var len=p.tail+h2(c,cyc)*p.tailvar;
    var x=-2+c*CW+CW/2+ (h2(c,cyc)-0.5)*p.xjit;
    var n=Math.max(2,Math.floor(len/p.dash));
    for(var k=0;k<n;k++){
      var y1=head-k*p.dash;
      var y0=y1-p.dash*p.duty*0.01;
      if(y1<-4||y0>104)continue;
      var bright=(k===0)?1:Math.max(0,1-k/n);
      if(bright<=0.04)continue;
      var w=(p.minw+bright*p.maxw)*0.05;
      var ra=(p.opacity===undefined?70:p.opacity)*0.01;
      S(ctx,Math.min(1,(0.15+bright*0.85)*ra+(ra>0.99?0.15:0)),w);
      seg(ctx,x,Math.max(-3,y0),x,Math.min(103,y1));}}
  ctx.globalAlpha=1;
}
function icoInterference(ctx,t,p){
  clearL(ctx);
  var drift=t*p.speed*0.0004;
  var pairs=p.pairs;
  for(var q=0;q<pairs;q++){
    /* each pair of sources sits on its own slowly turning axis */
    var ang=q*Math.PI/pairs+drift*(q%2?-0.6:1);
    var d=p.sep+Math.sin(drift*1.7+q)*p.sepVar;
    var cx=50+Math.cos(ang+1.2)*p.offset*(q?1:0);
    var cy=50+Math.sin(ang+1.2)*p.offset*(q?1:0);
    var ca=Math.cos(ang), sa=Math.sin(ang);
    var c=d/2;
    var lam=p.lambda*0.1;
    var phase=Math.sin(drift*p.pulse*0.1)*lam*0.5;
    S(ctx,p.alpha*0.01,p.weight*0.1);
    for(var n=-p.orders;n<=p.orders;n++){
      var A=(n*lam+phase)/2;
      if(Math.abs(A)>=c)continue;
      var B=Math.sqrt(c*c-A*A);
      for(var br=0;br<2;br++){
        ctx.beginPath();
        var started=false;
        for(var k=-p.extent;k<=p.extent;k+=p.extent/28){
          var lx=(br?1:-1)*A*Math.cosh(k);
          var ly=B*Math.sinh(k);
          var X=cx+lx*ca-ly*sa, Y=cy+lx*sa+ly*ca;
          if(X<-30||X>130||Y<-30||Y>130){started=false;continue;}
          if(!started){ctx.moveTo(X,Y);started=true;}else ctx.lineTo(X,Y);}
        ctx.stroke();}}
    if(p.sources>0){
      ctx.globalAlpha=0.85;ctx.fillStyle=CUR.ink;
      [[-c,0],[c,0]].forEach(function(s){
        var X=cx+s[0]*ca, Y=cy+s[0]*sa;
        ctx.beginPath();ctx.arc(X,Y,p.sources*0.3,0,7);ctx.fill();});}}
  ctx.globalAlpha=1;
}
function icoHarmonicSpeech(ctx,t,p){
  clearL(ctx);
  var seq=[[3,2,5,4],[5,4,7,6],[4,3,7,5],[5,3,8,5],[7,5,9,7],[3,4,9,8]];
  var phase=t*p.morph*0.0001;
  var i0=Math.floor(phase)%seq.length, i1=(i0+1)%seq.length;
  var f=phase-Math.floor(phase);
  var ease=f<0.5?2*f*f:1-Math.pow(-2*f+2,2)/2;
  var A=seq[i0], B=seq[i1];
  var ph=t*p.phase*0.0004, R=p.amp*0.01*46;
  var w2=p.second*0.01, w3=p.third*0.01;
  /* syllable train: fast attack, slow decay, gaps between words */
  var st=t*p.rate*0.001, idx=Math.floor(st), fr=st-idx;
  var loud=h1(idx)*0.75+0.25;
  var dur=0.45+h1(idx+0.5)*0.4;
  var gap=h1(idx+0.31)<0.18;
  var env=0;
  if(!gap&&fr<dur){var u2=fr/dur;env=loud*Math.pow(1-u2,1.4)*Math.min(1,u2*12);}
  /* the peak travels around the curve so it reads as a passing pulse */
  var travel=(t*p.travel*0.001)%1;
  function pt(u,C,shift){
    var x=Math.sin(C[0]*u+ph+shift)+w2*Math.sin(C[2]*u+ph*1.3+shift)
         +w3*Math.sin((C[0]+C[2])*u-ph*0.7);
    var y=Math.sin(C[1]*u)+w2*Math.sin(C[3]*u+ph*0.9)
         +w3*Math.sin((C[1]+C[3])*u+ph*1.1);
    var norm=1/(1+w2+w3);
    /* local radial bump, wrapped so the curve stays closed */
    var uu=u/(Math.PI*2);
    var dd=Math.abs(((uu-travel+1.5)%1)-0.5);
    var bump=Math.exp(-Math.pow(dd/(p.width*0.01),2))*env*p.depth2*0.01;
    var k=1+bump;
    return [50+x*R*norm*k,50+y*R*norm*k];}
  function curve(shift,alpha,w){
    S(ctx,alpha,w);
    ctx.beginPath();
    for(var i=0;i<=p.steps;i++){
      var u=i/p.steps*Math.PI*2;
      var a=pt(u,A,shift), b=pt(u,B,shift);
      var x=a[0]+(b[0]-a[0])*ease, y=a[1]+(b[1]-a[1])*ease;
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
    ctx.closePath();ctx.stroke();}
  for(var g=p.ghosts;g>=1;g--)curve(g*p.spread*0.01,0.26/g,p.weight*0.1*0.75);
  curve(0,0.92,p.weight*0.1*(1+env*0.6));
  ctx.globalAlpha=1;
}
function icoModularSquare(ctx,t,p){
  clearL(ctx);
  var N=p.points, S2=p.size;
  var m=p.mbase+Math.sin(t*p.drift*0.00004)*p.range;
  function perim(k){
    var u=((k%N)+N)/N%1;
    var s=u*4, side=Math.floor(s), f=s-side;
    var a=50-S2/2, b=50+S2/2;
    if(side===0)return [a+f*S2,a];
    if(side===1)return [b,a+f*S2];
    if(side===2)return [b-f*S2,b];
    return [a,b-f*S2];}
  S(ctx,p.alpha*0.01,p.weight*0.1);
  ctx.beginPath();
  for(var i=0;i<N;i++){
    var A=perim(i), B=perim(i*m);
    ctx.moveTo(A[0],A[1]);ctx.lineTo(B[0],B[1]);}
  ctx.stroke();
  if(p.frame>0){S(ctx,0.8,p.weight*0.1*1.6);
    ctx.strokeRect(50-S2/2,50-S2/2,S2,S2);}
  ctx.globalAlpha=1;
}
function icoAccordion2(ctx,t,p){
  clearL(ctx);
  var W=Math.max(1,Math.round(p.wheels));
  for(var w=0;w<W;w++){
    var sd=h1(w*3.7);
    var cx=50, cy=50, sc=1;
    if(W>1){
      var a0=(w/W)*Math.PI*2+p.arrange*0.01;
      cx=50+Math.cos(a0)*p.wheelSpread;
      cy=50+Math.sin(a0)*p.wheelSpread;
      sc=p.wheelScale*0.01*(0.7+sd*0.6);}
    var dir=(p.alternate>0&&w%2)?-1:1;
    var base=t*p.spin*0.001*dir*(1+sd*p.rateVar*0.01)+sd*20;
    var spin=base+Math.sin(base*p.easeRate*0.1)*p.ease*0.1;
    var N=Math.max(6,Math.round(p.spokes/(W>1?W*0.7:1)));
    for(var i=0;i<N;i++){
      var u=i/N, th=u*Math.PI*2;
      var warp=Math.sin(th*p.harm-spin*p.travel*0.1)*p.squeeze*0.01;
      var a=th+spin+warp;
      var dens=Math.cos(th*p.harm-spin*p.travel*0.1);
      var k=0.5+0.5*dens;
      var r0=(p.inner+k*p.innerVar)*sc;
      var r1=r0+(p.len*(1-p.lenVar*0.01*k)+p.reach*0.1)*sc;
      S(ctx,(p.alpha*0.01)*(0.35+0.65*(p.invert>0?1-k:k)),
        (p.minw+(p.invert>0?1-k:k)*p.maxw)*0.05);
      if(p.taper>0){
        var wq=(p.taper*0.01)*(0.6+k*0.8);
        ctx.beginPath();
        ctx.moveTo(cx+Math.cos(a-wq)*r0,cy+Math.sin(a-wq)*r0);
        ctx.lineTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);
        ctx.lineTo(cx+Math.cos(a+wq)*r0,cy+Math.sin(a+wq)*r0);
        ctx.stroke();
      }else{
        seg(ctx,cx+Math.cos(a)*r0,cy+Math.sin(a)*r0,
                cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);}}
    if(p.hub>0){S(ctx,0.65,p.weight*0.1*1.2);
      ctx.beginPath();ctx.arc(cx,cy,p.hub*sc,0,7);ctx.stroke();}}
  ctx.globalAlpha=1;
}
function icoTerrainSmooth(ctx,t,p){
  clearL(ctx);
  var NX=p.nx, NZ=p.nz;
  var cell=p.cell*0.1, depth=p.depth*0.1;
  var scroll=t*p.speed*0.004;
  var base=Math.floor(scroll), frac=scroll-base;
  var pitch=p.pitch*Math.PI/180, camH=p.camh, FOV=p.fov;
  var cp=Math.cos(pitch), spn=Math.sin(pitch);
  function terrain(wx,wz){
    var hgt=Math.sin(wx*0.16+wz*0.11)*1.0
           +Math.sin(wx*0.07-wz*0.13)*0.8
           +Math.sin(wx*0.31+wz*0.27)*0.35
           +Math.sin(wx*0.04+wz*0.03)*1.2;
    hgt/=3.35;
    if(p.ridge>0)hgt=Math.abs(hgt)*1.5-0.45;
    return hgt*p.amp;}
  function proj(wx,wy,rz){
    var ry=wy-camH;
    var y2=ry*cp+rz*spn, z2=-ry*spn+rz*cp;
    if(z2<0.4)return null;
    return [50+wx*FOV/z2,50-y2*FOV/z2];}
  /* rows are fixed in world space; the camera advances through them,
     so relative distance changes continuously with no snap */
  for(var j=NZ;j>=1;j--){
    var kFar=base+j, kNear=base+j-1;
    var rzFar=(j-frac)*depth, rzNear=(j-1-frac)*depth;
    var wzFar=kFar*depth, wzNear=kNear*depth;
    for(var i=0;i<NX;i++){
      var x0=(i-NX/2)*cell, x1=(i+1-NX/2)*cell;
      var a=proj(x0,terrain(x0,wzFar),rzFar);
      var b=proj(x1,terrain(x1,wzFar),rzFar);
      var c=proj(x1,terrain(x1,wzNear),rzNear);
      var d=proj(x0,terrain(x0,wzNear),rzNear);
      if(!a||!b||!c||!d)continue;
      if(a[0]>115&&b[0]>115&&c[0]>115&&d[0]>115)continue;
      if(a[0]<-15&&b[0]<-15&&c[0]<-15&&d[0]<-15)continue;
      ctx.beginPath();
      ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);
      ctx.lineTo(c[0],c[1]);ctx.lineTo(d[0],d[1]);ctx.closePath();
      ctx.globalAlpha=1;ctx.fillStyle=CUR.paper;ctx.fill();
      var far=j/NZ;
      S(ctx,Math.max(0.18,1-far*0.7),p.weight*0.1);
      ctx.stroke();}}
  ctx.globalAlpha=1;
}
function icoGlobe(ctx,t,p){
  clearL(ctx);
  var R=p.radius*p.zoom*0.01;
  var CX=50+p.offx, CY=50+p.offy;
  var spin=t*p.spin*0.0006;
  var tilt=p.tilt*Math.PI/180;
  var elev=p.elev*Math.PI/180;
  var ct=Math.cos(tilt), stl=Math.sin(tilt);
  var ce=Math.cos(elev), se=Math.sin(elev);
  /* lat/lon -> world, then axial tilt, then camera elevation */
  function P(lat,lon){
    var cl=Math.cos(lat), x=cl*Math.cos(lon+spin), y=Math.sin(lat), z=cl*Math.sin(lon+spin);
    var x2=x*ct-y*stl, y2=x*stl+y*ct;
    var y3=y2*ce-z*se, z3=y2*se+z*ce;
    return [CX+x2*R, CY-y3*R, z3];}
  function draw(pts,frontA,backA,w){
    /* split the path wherever it crosses the limb so front and back
       can carry different weights */
    var cur=null;
    for(var i=0;i<pts.length;i++){
      var q=pts[i], front=q[2]>=0;
      if(cur===null||cur!==front){
        if(cur!==null)ctx.stroke();
        var a=front?frontA:backA;
        if(a<=0.02){cur=front;ctx.beginPath();continue;}
        S(ctx,a,w*(front?1:0.75));
        ctx.beginPath();ctx.moveTo(q[0],q[1]);
        cur=front;continue;}
      var a2=front?frontA:backA;
      if(a2<=0.02)continue;
      ctx.lineTo(q[0],q[1]);}
    ctx.stroke();}
  var fa=p.alpha*0.01, ba=p.back*0.01*fa;
  /* parallels */
  if(p.lat>0){
    var NL=p.lat;
    for(var i=1;i<NL;i++){
      var lat=-Math.PI/2+Math.PI*(i/NL);
      var pts=[];
      for(var k=0;k<=96;k++)pts.push(P(lat,k/96*Math.PI*2));
      var eq=Math.abs(lat)<0.001;
      draw(pts,fa*(eq?1:0.85),ba*(eq?1:0.85),p.weight*0.1*(eq&&p.equator>0?1.8:1));}}
  /* meridians */
  if(p.lon>0){
    var NM=p.lon;
    for(var m=0;m<NM;m++){
      var lon=m/NM*Math.PI*2;
      var pts2=[];
      for(var k2=0;k2<=96;k2++)pts2.push(P(-Math.PI/2+Math.PI*(k2/96),lon));
      draw(pts2,fa,ba,p.weight*0.1);}}
  /* limb */
  if(p.limb>0){
    S(ctx,Math.min(1,fa*1.2),p.weight*0.1*1.5);
    ctx.beginPath();ctx.arc(CX,CY,R,0,7);ctx.stroke();}
  /* polar axis */
  if(p.axis>0){
    S(ctx,fa*0.6,p.weight*0.1);
    var a1=P(Math.PI/2,0), a2=P(-Math.PI/2,0);
    var ex=p.axisExt*0.01;
    seg(ctx,CX+(a1[0]-CX)*(1+ex),CY+(a1[1]-CY)*(1+ex),
            CX+(a2[0]-CX)*(1+ex),CY+(a2[1]-CY)*(1+ex));}
  /* satellites on inclined orbits, with fading trails */
  if(p.sats>0){
    for(var s=0;s<p.sats;s++){
      var sd=h1(s*4.7);
      var inc=(0.25+sd*1.1)*(s%2?-1:1);
      var node=sd*Math.PI*2;
      var rr=R*(1+p.satAlt*0.01+sd*p.satAltVar*0.01);
      var sp=t*p.satSpeed*0.0009*(0.6+sd*0.9)+sd*30;
      var ci=Math.cos(inc), si=Math.sin(inc);
      var cn=Math.cos(node), sn=Math.sin(node);
      function SP(u){
        var x=Math.cos(u), y=0, z=Math.sin(u);
        var y2=y*ci-z*si, z2=y*si+z*ci;
        var x3=x*cn-z2*sn, z3=x*sn+z2*cn;
        var y4=y2*ce-z3*se, z4=y2*se+z3*ce;
        return [CX+x3*rr, CY-y4*rr, z4];}
      var TL=p.satTrail;
      for(var k3=0;k3<TL;k3++){
        var u0=sp-k3*p.satStep*0.01, u1=u0-p.satStep*0.01;
        var A=SP(u0), B=SP(u1);
        var f=1-k3/TL;
        /* hide the part of the trail passing behind the globe */
        var hid=(A[2]<0&&Math.hypot(A[0]-CX,A[1]-CY)<R);
        if(hid&&p.satOcclude>0)continue;
        S(ctx,f*f*fa*(hid?0.25:1),p.weight*0.1*(0.4+f*1.1));
        seg(ctx,A[0],A[1],B[0],B[1]);}
      var H=SP(sp);
      if(!(H[2]<0&&Math.hypot(H[0]-CX,H[1]-CY)<R&&p.satOcclude>0)){
        ctx.globalAlpha=Math.min(1,fa*1.3);ctx.fillStyle=CUR.ink;
        ctx.beginPath();ctx.arc(H[0],H[1],p.satSize*0.3,0,7);ctx.fill();}}}
  ctx.globalAlpha=1;
}

/* ============================================================
   LOCKED SETTINGS — one icon per category
   ============================================================ */
var PARAMS = {
  'fabrication': ["icoFacet",{slices:23,sides:14,radius:49,squash:65,twist:104,spin:10,
    morph:16,drift:5,zoom:165,solid:0,edges:1,edgeEvery:1,weight:10}],
  'hand-skills': ["icoLineGradient",{opacity:100,speed:53,scale:7,contrast:200,spacing:56,
    res:2,waver:11,floorv:0,minw:8,maxw:22}],
  'digital-skills': ["icoLineRain",{opacity:100,cols:80,smin:17,smax:42,tail:90,tailvar:50,
    dash:3,duty:70,minw:6,maxw:14,xjit:3}],
  'professional-skills': ["icoInterference",{pairs:2,sep:50,sepVar:0,offset:10,lambda:73,
    orders:10,extent:9,pulse:5,speed:10,alpha:100,weight:8,sources:0}],
  'talks': ["icoHarmonicSpeech",{rate:26,depth2:58,width:18,travel:21,morph:40,phase:27,
    amp:110,second:0,third:0,steps:510,ghosts:5,spread:39,ghostAlpha:60,ghostFall:10,
    ghostWeight:100,weight:10}],
  'social': ["icoModularSquare",{points:52,mbase:3,range:3,drift:100,size:102,alpha:90,
    weight:7,frame:0}],
  'culture': ["icoAccordion2",{wheels:1,wheelSpread:26,wheelScale:75,arrange:0,alternate:0,
    rateVar:0,spokes:65,spin:4,ease:35,easeRate:12,harm:5,squeeze:0,travel:0,inner:0,
    innerVar:0,len:60,lenVar:0,reach:222,taper:0,invert:0,minw:9,maxw:10,alpha:100,
    weight:8,hub:0}],
  'field-trip': ["icoTerrainSmooth",{pitch:45,camh:14,fov:51,speed:10,nx:60,nz:40,cell:20,
    depth:16,amp:7,ridge:0,weight:7}],
  /* alternate Field Trip treatment — point 'field-trip' here to use it */
  'field-trip-globe': ["icoGlobe",{radius:41,zoom:118,offx:0,offy:0,spin:13,tilt:9,elev:27,
    lat:6,lon:31,equator:0,limb:1,axis:0,axisExt:0,alpha:71,back:16,weight:7,sats:1,
    satAlt:2,satAltVar:15,satSpeed:26,satTrail:43,satStep:20,satSize:6,satOcclude:0}]
};

var FNS = {icoFacet:icoFacet, icoLineGradient:icoLineGradient, icoLineRain:icoLineRain,
  icoInterference:icoInterference, icoHarmonicSpeech:icoHarmonicSpeech,
  icoModularSquare:icoModularSquare, icoAccordion2:icoAccordion2,
  icoTerrainSmooth:icoTerrainSmooth, icoGlobe:icoGlobe};

var FALLBACK = 'fabrication';

/* ============================================================
   PALETTE
   ============================================================ */
function readPalette(el){
  var s = getComputedStyle(el);
  var ink = s.getPropertyValue('--ink').trim();
  var paper = s.getPropertyValue('--paper').trim();
  if(ink) CUR.ink = ink;
  if(paper) CUR.paper = paper;
}
window.addEventListener('edition:palette', function(e){
  if(e.detail){ CUR.ink = e.detail.ink; CUR.paper = e.detail.paper; }
  repaintAll();
});

/* ============================================================
   ONE TICKER FOR THE WHOLE PAGE
   ============================================================ */
var TICK = [], running = false;
var reduced = window.matchMedia &&
              window.matchMedia('(prefers-reduced-motion: reduce)').matches;

var io = ('IntersectionObserver' in window)
  ? new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.target.__edi) e.target.__edi.vis = e.isIntersecting; });
    }, {threshold:0.01, rootMargin:'150px'})
  : null;

/* the animations are slow by design, so half frame-rate is invisible
   and halves the cost on phones */
var THROTTLE = 2, frame = 0;
function loop(){
  frame++;
  if(frame % THROTTLE === 0){
    for(var i=0;i<TICK.length;i++){
      var o = TICK[i];
      if(!o.vis) continue;
      o.t++;
      paint(o);
    }
  }
  requestAnimationFrame(loop);
}

function repaintAll(){
  for(var i=0;i<TICK.length;i++) repaint(TICK[i]);
}

function slug(s){
  return (s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

/* ------------------------------------------------------------
   Pin the backing store to the element's real CONTENT box.

   Never assume the canvas is 100 CSS px just because the CSS says
   so: with box-sizing:border-box a border eats into the content
   box, and inside a flex row the element can be squeezed. Any
   mismatch between the backing store and the displayed size makes
   the browser resample the bitmap, which is what turns crisp
   hairlines into mush. Measuring and mapping the 100x100 drawing
   space onto the measured box means the scale factor is exact and
   nothing is ever resampled.
   ------------------------------------------------------------ */
function sizeCanvas(rec){
  var el = rec.el;
  var dpr = Math.min(window.devicePixelRatio || 1, 3);
  var cw = el.clientWidth  || 100;   /* content box, borders excluded */
  var ch = el.clientHeight || 100;
  var bw = Math.max(1, Math.round(cw * dpr));
  var bh = Math.max(1, Math.round(ch * dpr));
  if(el.width !== bw || el.height !== bh){ el.width = bw; el.height = bh; }
  /* map the 100x100 drawing space exactly onto the buffer */
  rec.ctx.setTransform(bw / 100, 0, 0, bh / 100, 0, 0);
  rec.sw = 100 / cw;               /* stroke compensation */
  rec.scale = {css:[cw, ch], buffer:[bw, bh], dpr:dpr};
}
var INVERT = false;
function paint(rec){
  CUR.sw = rec.sw || 1;
  if(INVERT){
    var i = CUR.ink, p2 = CUR.paper;
    CUR.ink = p2; CUR.paper = i;
    try{ rec.fn(rec.ctx, rec.t, rec.p); }catch(e){}
    CUR.ink = i; CUR.paper = p2;
  }else{
    try{ rec.fn(rec.ctx, rec.t, rec.p); }catch(e){}
  }
}
function repaint(rec){ paint(rec); }

Edition.mountIcons = function(root){
  root = root || document;
  var nodes = root.querySelectorAll('canvas.edi-icon:not([data-edi-mounted])');
  Array.prototype.forEach.call(nodes, function(el){
    el.setAttribute('data-edi-mounted','1');
    readPalette(el);
    var key = slug(el.getAttribute('data-category'));
    var def = PARAMS[key] || PARAMS[FALLBACK];
    var fn = FNS[def[0]];
    if(!fn) return;

    var ctx = el.getContext('2d');
    var rec = {ctx:ctx, fn:fn, p:def[1], t:Math.random()*3000|0, vis:true, el:el};
    el.__edi = rec;
    sizeCanvas(rec);
    if(typeof ResizeObserver === 'function'){
      var ro = new ResizeObserver(function(){ sizeCanvas(rec); repaint(rec); });
      ro.observe(el);
    }

    if(reduced){ repaint(rec); return; }
    TICK.push(rec);
    if(io) io.observe(el);
    if(!running){ running = true; requestAnimationFrame(loop); }
  });
};

/* Webflow Collection Lists sometimes paint after DOMContentLoaded */
if(document.readyState === 'complete') Edition.mountIcons(document);
else window.addEventListener('load', function(){ Edition.mountIcons(document); });

/* exposed for debugging / a static export */
/* Icons drawn with the two colours swapped: the icon's ground becomes
   the site's ink and its lines become the site's paper. */
Edition.setIconInvert = function(on){
  INVERT = !!on;
  document.documentElement.classList.toggle('edi-invert', INVERT);
  repaintAll();
  return INVERT;
};
Edition.toggleIconInvert = function(){ return Edition.setIconInvert(!INVERT); };

Edition.iconParams = PARAMS;

/* Run Edition.checkIcons() in the console. Every row should show a
   scale of exactly 1.000 — anything else means the canvas is being
   resampled and will look soft. */
Edition.checkIcons = function(){
  var rows = [];
  for(var i=0;i<TICK.length;i++){
    var s2 = TICK[i].scale; if(!s2) continue;
    rows.push({
      css: s2.css[0] + ' x ' + s2.css[1],
      buffer: s2.buffer[0] + ' x ' + s2.buffer[1],
      dpr: s2.dpr,
      scale: +(s2.buffer[0] / (s2.css[0] * s2.dpr)).toFixed(3),
      crisp: Math.abs(s2.buffer[0] - s2.css[0] * s2.dpr) < 0.51 &&
             Math.abs(s2.buffer[1] - s2.css[1] * s2.dpr) < 0.51
    });
  }
  if(console.table) console.table(rows);
  return rows;
};
Edition.drawIcon = function(ctx, key, t, strokeComp){
  var d = PARAMS[slug(key)] || PARAMS[FALLBACK];
  CUR.sw = strokeComp || 1;
  FNS[d[0]](ctx, t, d[1]);
};
})();
