export interface DbParameter {
    id: number;
    name: string;
    unit: string | null;
    description: string | null;
}

export interface LocationItem {
    id: number;
    name: string;
    type: string;
    lat: number;
    lng: number;
    organization: string;
}

export interface MeasurementResult {
    concentrated: number;
    status: "safe" | "warning" | "danger";
    message: string;
    confidence?: number;
    boundingBox?: any;
}
