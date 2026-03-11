declare namespace google.maps {
  class Map {
    constructor(element: HTMLElement, options?: MapOptions);
  }

  interface MapOptions {
    center?: LatLngLiteral;
    zoom?: number;
  }

  interface LatLngLiteral {
    lat: number;
    lng: number;
  }

  interface LatLng {
    lat(): number;
    lng(): number;
  }

  namespace places {
    class Autocomplete {
      constructor(input: HTMLInputElement, options?: AutocompleteOptions);
      addListener(event: string, handler: () => void): void;
      getPlace(): PlaceResult;
    }

    interface AutocompleteOptions {
      types?: string[];
      fields?: string[];
    }

    interface PlaceResult {
      formatted_address?: string;
      geometry?: {
        location?: LatLng;
      };
    }
  }
}
