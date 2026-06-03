declare namespace naver {
  namespace maps {
    class Map {
      constructor(el: HTMLElement | string, options: MapOptions);
      setCenter(latlng: LatLng): void;
      setZoom(level: number): void;
    }
    class LatLng {
      constructor(lat: number, lng: number);
      lat(): number;
      lng(): number;
    }
    class Marker {
      constructor(options: MarkerOptions);
      setMap(map: Map | null): void;
      addListener(event: string, handler: () => void): void;
    }
    class InfoWindow {
      constructor(options: InfoWindowOptions);
      open(map: Map, anchor: Marker): void;
      close(): void;
    }
    interface MapOptions {
      center: LatLng;
      zoom: number;
      minZoom?: number;
      maxZoom?: number;
    }
    interface MarkerOptions {
      position: LatLng;
      map?: Map;
      title?: string;
      icon?: string | MarkerImage;
    }
    interface MarkerImage {
      url: string;
      size?: Size;
      anchor?: Point;
    }
    interface InfoWindowOptions {
      content: string;
      borderWidth?: number;
    }
    class Size {
      constructor(width: number, height: number);
    }
    class Point {
      constructor(x: number, y: number);
    }
  }
}
