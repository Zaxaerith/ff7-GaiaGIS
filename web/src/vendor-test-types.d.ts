declare module 'd3-geo-projection' {
  export function geoMollweideRaw(lambda:number,phi:number):[number,number];
  export function geoWinkel3Raw(lambda:number,phi:number):[number,number];
  export function geoRobinsonRaw(lambda:number,phi:number):[number,number];
  export function geoSinusoidalRaw(lambda:number,phi:number):[number,number];
  export function geoCylindricalEqualAreaRaw(phi0:number):(lambda:number,phi:number)=>[number,number];
}
declare module 'd3-geo' {
  export function geoArea(object:{type:'Polygon';coordinates:number[][][]}):number;
  export function geoMercatorRaw(lambda:number,phi:number):[number,number];
  export function geoEqualEarthRaw(lambda:number,phi:number):[number,number];
  export function geoNaturalEarth1Raw(lambda:number,phi:number):[number,number];
  export function geoAzimuthalEqualAreaRaw(lambda:number,phi:number):[number,number];
  export function geoAzimuthalEquidistantRaw(lambda:number,phi:number):[number,number];
}
