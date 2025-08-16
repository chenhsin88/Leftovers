import { Component, Input, ViewChild, ElementRef, AfterViewInit, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Map } from 'maplibre-gl';
import { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson';
import { Merchant } from '../../@Services/users-services.service';

@Component({
  selector: 'app-carto-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './carto-map.component.html',
  styleUrls: ['./carto-map.component.scss']
})
export class CartoMapComponent implements AfterViewInit, OnChanges {
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;

  @Input() merchants: Merchant[] = [];
  @Input() userLocation: { lat: string, lon: string } | null = null;
  @Output() merchantClicked = new EventEmitter<Merchant>();

  private map: Map | undefined;
  public tooltip: { content: string, x: number, y: number } | null = null;

  ngAfterViewInit(): void {
    this.initializeMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.map && changes['merchants']) {
      this.updateMapData();
    }
    if (this.map && changes['userLocation'] && this.userLocation) {
      this.map.flyTo({
        center: [parseFloat(this.userLocation.lon), parseFloat(this.userLocation.lat)],
        zoom: 14
      });
      // 當位置更新時，也更新「我的位置」圖層
      this.updateUserLocationLayer();
    }
  }

  private initializeMap(): void {
    const defaultLocation = { lon: '120.3016', lat: '22.6282' };
    const initialLocation = this.userLocation || defaultLocation;

    this.map = new Map({
      container: this.mapContainer.nativeElement,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [parseFloat(initialLocation.lon), parseFloat(initialLocation.lat)],
      zoom: 13
    });

    this.map.on('load', () => {
      // 1. 設定商家的 source 和 layer (不變)
      this.map!.addSource('merchants-source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map!.addLayer({
        id: 'merchants-layer', type: 'circle', source: 'merchants-source',
        paint: {
          'circle-radius': 8, 'circle-color': '#c91717ff', 'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF', 'circle-opacity': 1.0
        }
      });

      // 2. 新增「我的位置」圖層
      this.updateUserLocationLayer();

      // 3. 設定互動與更新資料
      this.setupMapInteractions();
      this.updateMapData();
    });
  }

  // ★★★ 新增/修改這個方法，專門處理「我的位置」圖層 ★★★
  private updateUserLocationLayer(): void {
    if (!this.map || !this.userLocation) return;

    // 將「我的位置」轉換成 GeoJSON 格式
    const userGeoJson: FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [parseFloat(this.userLocation.lon), parseFloat(this.userLocation.lat)]
        },
        properties: {}
      }]
    };

    const source = this.map.getSource('user-location-source') as any;

    // 如果 source 已經存在，就只更新資料；如果不存在，就新增 source 和 layer
    if (source) {
      source.setData(userGeoJson);
    } else {
      this.map.addSource('user-location-source', { type: 'geojson', data: userGeoJson });

      // 新增一個內層的實心藍點
      this.map.addLayer({
        id: 'user-location-point',
        source: 'user-location-source',
        type: 'circle',
        paint: {
          'circle-radius': 8,
          'circle-color': '#007cff',
          'circle-stroke-color': 'white',
          'circle-stroke-width': 2,
        }
      });
this.map.addLayer({
      id: 'user-location-halo',
      source: 'user-location-source',
      type: 'circle',
      paint: {
        'circle-radius': 25, // 設定一個較大的固定半徑
        'circle-color': '#007cff',
        'circle-opacity': 0 // 初始狀態完全透明
      }
    });

      // 讓光暈動起來
     const animateHalo = () => {
      // 確保地圖和圖層還存在，避免在切換頁面後繼續執行
      if (!this.map || !this.map.getLayer('user-location-halo')) return;

      // 步驟 A: 讓光暈短暫出現 (變得不透明)
      this.map.setPaintProperty('user-location-halo', 'circle-opacity', 0.3);

      // 步驟 B: 短暫延遲後，讓光暈消失 (變回完全透明)
      setTimeout(() => {
        if (!this.map || !this.map.getLayer('user-location-halo')) return;
        this.map.setPaintProperty('user-location-halo', 'circle-opacity', 0);
      }, 400); // 光暈顯示 0.4 秒

      // 步驟 C: 預約下一次閃爍
      setTimeout(animateHalo, 2000); // 每 2 秒閃爍一次
    };

    // 啟動動畫
    animateHalo();
  }
  }

  private updateMapData(): void {
    if (!this.map || !this.map.getSource('merchants-source')) return;

    const geojsonData = this.transformToGeoJSON(this.merchants);
    console.log('[CartoMap] 更新點位，Feature 數量:', geojsonData.features.length);

    const source = this.map.getSource('merchants-source') as any;
    source.setData(geojsonData);
  }

  // (以下 transformToGeoJSON 和 setupMapInteractions 函式保持不變)
  private transformToGeoJSON(merchants: Merchant[]): FeatureCollection<Geometry, GeoJsonProperties> {
    const features = merchants
      .filter(m => m.longitudeAndLatitude && m.longitudeAndLatitude.includes(','))
      .map(merchant => {
        const [lon, lat] = merchant.longitudeAndLatitude!.split(',').map(Number);
       const foodListString = merchant.foodList.map(food => `• ${food.name}`).join('\n');

        // ★ 2. 組合最終的提示框內容
        const tooltipContent = `${merchant.name}\n────────────\n${foodListString}`;

        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [lon, lat] },
          // ★ 3. 將組合好的內容放入 properties 中
          properties: {
            merchantsId: merchant.merchantsId,
            name: merchant.name,
            addressText: merchant.addressText,
            tooltipContent: foodListString ? tooltipContent : merchant.name // 如果沒有食物，就只顯示店名
          }
        };
      });
    return { type: 'FeatureCollection' as const, features: features };
  }

  private setupMapInteractions(): void {
    if (!this.map) return;
    this.map.on('click', 'merchants-layer', (e) => {
      if (e.features && e.features.length > 0) {
        const properties = e.features[0].properties as any;
        const clickedMerchant = this.merchants.find(m => m.merchantsId === properties.merchantsId);
        if (clickedMerchant) { this.merchantClicked.emit(clickedMerchant); }
      }
    });
    this.map.on('mousemove', 'merchants-layer', (e) => {
      this.map!.getCanvas().style.cursor = 'pointer';
      if (e.features && e.features.length > 0) {
        const properties = e.features[0].properties as any;
        // ★ 4. 使用新的 tooltipContent 屬性
        this.tooltip = { content: properties.tooltipContent, x: e.point.x, y: e.point.y };
      }
    });
    this.map.on('mouseleave', 'merchants-layer', () => {
      this.map!.getCanvas().style.cursor = '';
      this.tooltip = null;
    });
  }
}
