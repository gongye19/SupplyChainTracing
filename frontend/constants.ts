
import { Location, Shipment } from './types';

export const HUBS: Location[] = [
  { id: 'hsinchu', name: 'Hsinchu Science Park', lat: 24.77, lng: 120.99, type: 'hub', country: 'Taiwan' },
  { id: 'seoul', name: 'Samsung Giheung', lat: 37.28, lng: 127.11, type: 'hub', country: 'South Korea' },
  { id: 'hillsboro', name: 'Intel Hillsboro', lat: 45.54, lng: -122.92, type: 'hub', country: 'USA' },
  { id: 'veldhoven', name: 'ASML Veldhoven', lat: 51.41, lng: 5.40, type: 'hub', country: 'Netherlands' },
  { id: 'shanghai', name: 'SMIC Shanghai', lat: 31.23, lng: 121.47, type: 'hub', country: 'China' },
  { id: 'dresden', name: 'GlobalFoundries Dresden', lat: 51.12, lng: 13.72, type: 'hub', country: 'Germany' },
  { id: 'tokyo', name: 'Tokyo Electron Lab', lat: 35.67, lng: 139.65, type: 'hub', country: 'Japan' },
  { id: 'austin', name: 'Samsung Austin', lat: 30.26, lng: -97.74, type: 'hub', country: 'USA' },
];

export const MOCK_SHIPMENTS: Shipment[] = [
  { id: 's1', originId: 'veldhoven', destinationId: 'hsinchu', material: 'EUV Lithography', category: 'Equipment', quantity: 2, value: 350, status: 'delivered', timestamp: '2019-03-15T10:00:00Z' },
  { id: 's2', originId: 'hsinchu', destinationId: 'hillsboro', material: '5nm Wafers', category: 'Raw Material', quantity: 5000, value: 80, status: 'delivered', timestamp: '2021-08-20T11:30:00Z' },
  { id: 's3', originId: 'seoul', destinationId: 'austin', material: 'LPDDR5 RAM', category: 'Memory', quantity: 100000, value: 45, status: 'delivered', timestamp: '2016-11-10T14:20:00Z' },
  { id: 's4', originId: 'tokyo', destinationId: 'shanghai', material: 'Photoresist', category: 'Raw Material', quantity: 200, value: 12, status: 'delivered', timestamp: '2023-01-20T09:15:00Z' },
  { id: 's5', originId: 'dresden', destinationId: 'seoul', material: 'Automotive MCUs', category: 'Logic', quantity: 25000, value: 30, status: 'delivered', timestamp: '2018-05-18T08:00:00Z' },
  { id: 's6', originId: 'hsinchu', destinationId: 'tokyo', material: 'AI Accelerators', category: 'Logic', quantity: 1500, value: 60, status: 'in-transit', timestamp: '2025-05-20T12:00:00Z' },
  { id: 's7', originId: 'veldhoven', destinationId: 'seoul', material: 'EUV Components', category: 'Equipment', quantity: 5, value: 150, status: 'in-transit', timestamp: '2025-05-15T08:00:00Z' },
];
