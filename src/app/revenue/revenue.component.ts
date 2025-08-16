import { Component, ViewChild, ElementRef, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import Chart from "chart.js/auto";
import { HttpClientService } from "../@http-services/http.service";
import { ActivatedRoute } from "@angular/router";
import { finalize } from "rxjs/operators";
import { Subscription } from "rxjs";

// Interface definitions (no change)
interface YearRevenue {
  year: string;
  revenue: number;
}
interface MonthRevenue {
  month: string;
  revenue: number;
}

@Component({
  selector: "app-revenue",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./revenue.component.html",
  styleUrls: ["./revenue.component.scss"],
})
export class RevenueComponent implements OnInit, OnDestroy {

  // --- Data Properties ---
  yearlyData: YearRevenue[] = [];
  monthlyData: MonthRevenue[] = [];
  currentYearRevenue: number = 0;
  lastYearRevenue: number = 0;
  growthRate: string = '0.0';
  avgMonthlyRevenue: number = 0;
  maxMonthlyRevenue: number = 0;
  currentDate: string = '';
  currentYear: number = new Date().getFullYear();
  maxRevenueMonth: string = '';
  yearRange: string = '';
  storeId: string | null = null;

  // --- State Properties ---
  public isLoading: boolean = true;
  public hasData: boolean = false;

  // --- Chart Instances ---
  private yearlyChart: Chart | null = null;
  private monthlyChart: Chart | null = null;
  private routeSub: Subscription | undefined;

  // --- ViewChild Setters (Robust way to get element references) ---
  private _yearlyChartRef: ElementRef<HTMLCanvasElement> | undefined;
  @ViewChild("yearlyChart") set yearlyChartRef(el: ElementRef<HTMLCanvasElement> | undefined) {
    console.log("📈 YearlyChart setter triggered. Element is:", el ? 'DEFINED' : 'UNDEFINED');
    if (el) {
      this._yearlyChartRef = el;
      this.createYearlyChart();
    }
  }

  private _monthlyChartRef: ElementRef<HTMLCanvasElement> | undefined;
  @ViewChild("monthlyChart") set monthlyChartRef(el: ElementRef<HTMLCanvasElement> | undefined) {
    console.log("📊 MonthlyChart setter triggered. Element is:", el ? 'DEFINED' : 'UNDEFINED');
    if (el) {
      this._monthlyChartRef = el;
      this.createMonthlyChart();
    }
  }

  constructor(
    private httpClientService: HttpClientService,
    private route: ActivatedRoute,
  ) {
    this.currentDate = new Date().toLocaleDateString("zh-TW");
  }

  ngOnInit(): void {
    console.log("--- RevenueComponent ngOnInit ---");
    this.routeSub = this.route.parent?.paramMap.subscribe(params => {
      const newStoreId = params.get('storeId');
      console.log(`[ngOnInit] Detected storeId: ${newStoreId}`);
      if (newStoreId) {
        this.storeId = newStoreId;
        this.fetchRevenueData(this.storeId);
      } else {
        console.error("[ngOnInit] Could not get storeId from route.");
        this.isLoading = false;
        this.hasData = false;
      }
    });
  }

  fetchRevenueData(merchantId: string): void {
    console.log(`[fetchRevenueData] 🚀 Starting fetch for merchant: ${merchantId}`);
    this.isLoading = true;
    this.hasData = false; // Reset state before fetching
    this.destroyCharts(); // Destroy old charts before creating new ones

    this.httpClientService.getApi<any>(`http://localhost:8080/historyOrder/getAllRevenueHistory/${merchantId}`)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          console.log("[fetchRevenueData] 🏁 Fetch finalized. isLoading set to false.");
        })
      )
      .subscribe({
        next: (res) => {
          console.log("[Debug] Raw API Response:", JSON.stringify(res, null, 2));
          const vo = res?.historyGetAllPriceByMerchantIdVo;

          // ⭐【核心修正】: 將 vo.yearlyRevenue 改為 vo.yearRevenue
          if (vo && Array.isArray(vo.yearRevenue) && vo.yearRevenue.length > 0) {
            console.log("[fetchRevenueData] ✅ Data check PASSED. Processing data...");

            // ⭐【核心修正】: 將 vo.yearlyRevenue 改為 vo.yearRevenue
            this.yearlyData = vo.yearRevenue.map((item: any) => ({ year: item.year.toString(), revenue: item.revenue }))
              .sort((a: YearRevenue, b: YearRevenue) => Number(a.year) - Number(b.year));

            this.monthlyData = vo.monthlyRevenue.map((item: any) => ({ month: item.month, revenue: item.revenue }))
              .sort((a: MonthRevenue, b: MonthRevenue) => parseInt(a.month.replace('月', '')) - parseInt(b.month.replace('月', '')));

            const currentYearStr = this.currentYear.toString();
            const lastYearStr = (this.currentYear - 1).toString();

            this.currentYearRevenue = this.yearlyData.find(d => d.year === currentYearStr)?.revenue || 0;
            this.lastYearRevenue = this.yearlyData.find(d => d.year === lastYearStr)?.revenue || 0;

            const totalMonthlyRevenue = this.monthlyData.reduce((sum, item) => sum + item.revenue, 0);
            const numberOfMonths = this.monthlyData.length;

            this.growthRate = this.lastYearRevenue > 0 ? (((this.currentYearRevenue - this.lastYearRevenue) / this.lastYearRevenue) * 100).toFixed(1) : '0.0';
            this.avgMonthlyRevenue = numberOfMonths > 0 ? Math.round(totalMonthlyRevenue / numberOfMonths) : 0;
            this.maxMonthlyRevenue = this.monthlyData.length > 0 ? Math.max(...this.monthlyData.map(d => d.revenue)) : 0;

            const maxMonthData = this.monthlyData.find(d => d.revenue === this.maxMonthlyRevenue);
            this.maxRevenueMonth = maxMonthData ? maxMonthData.month : '';

            const years = this.yearlyData.map(d => parseInt(d.year));
            if (years.length > 0) this.yearRange = `${Math.min(...years)}-${Math.max(...years)}`;

            this.hasData = true;
            console.log("[fetchRevenueData] hasData set to true. Waiting for view to update.");
          } else {
            console.log("[fetchRevenueData] ❌ Data check FAILED.");
            this.hasData = false;
          }
        },
        error: (err) => {
          console.error("[fetchRevenueData] ❌ API Request Failed:", err);
          this.hasData = false;
        }
      });
  }

  ngOnDestroy(): void {
    console.log("--- RevenueComponent ngOnDestroy ---");
    this.destroyCharts();
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }

  private destroyCharts(): void {
    if (this.yearlyChart) {
      console.log("Destroying existing yearly chart.");
      this.yearlyChart.destroy();
      this.yearlyChart = null;
    }
    if (this.monthlyChart) {
      console.log("Destroying existing monthly chart.");
      this.monthlyChart.destroy();
      this.monthlyChart = null;
    }
  }

  private createYearlyChart(): void {
    if (!this._yearlyChartRef || !this.hasData || this.yearlyChart) {
      console.log("[createYearlyChart] Skipped. Conditions not met.", { hasRef: !!this._yearlyChartRef, hasData: this.hasData, chartExists: !!this.yearlyChart });
      return;
    }
    console.log("[createYearlyChart] Creating yearly chart...");
    const ctx = this._yearlyChartRef.nativeElement.getContext("2d");
    if (ctx) {
      this.yearlyChart = new Chart(ctx, {
        type: "line",
        data: {
          labels: this.yearlyData.map((d) => d.year),
          datasets: [{
            label: "年度營收",
            data: this.yearlyData.map((d) => d.revenue),
            borderColor: "rgb(59, 130, 246)",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: "rgb(59, 130, 246)",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, ticks: { callback: (value) => "NT$ " + Number(value).toLocaleString("zh-TW") } },
            x: { grid: { display: false } }
          },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (context) => "營收: NT$ " + context.parsed.y.toLocaleString("zh-TW") } }
          }
        }
      });
    }
  }

  private createMonthlyChart(): void {
    if (!this._monthlyChartRef || !this.hasData || this.monthlyChart) {
      console.log("[createMonthlyChart] Skipped. Conditions not met.", { hasRef: !!this._monthlyChartRef, hasData: this.hasData, chartExists: !!this.monthlyChart });
      return;
    }
    console.log("[createMonthlyChart] Creating monthly chart...");
    const ctx = this._monthlyChartRef.nativeElement.getContext("2d");
    if (ctx) {
      this.monthlyChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: this.monthlyData.map((d) => d.month),
          datasets: [{
            label: "月度營收",
            data: this.monthlyData.map((d) => d.revenue),
            backgroundColor: "rgba(16, 185, 129, 0.8)",
            borderColor: "rgb(16, 185, 129)",
            borderWidth: 1,
            borderRadius: 6,
            borderSkipped: false,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 10, right: 10, bottom: 10, left: 10 } },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (value) => "NT$ " + Number(value).toLocaleString("zh-TW"), font: { size: 15, weight: 'bold' } },
              grid: { color: "rgba(0, 0, 0, 0.1)" },
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 15, weight: 'bold' } }
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              titleFont: { size: 16, weight: 'bold' },
              bodyFont: { size: 14 },
              footerFont: { size: 12 },
              callbacks: { label: (context) => "營收: NT$ " + context.parsed.y.toLocaleString("zh-TW") },
            },
          },
        },
      });
    }
  }

  formatCurrency(value: number): string {
    return value.toLocaleString("zh-TW");
  }

  getQuarterRevenue(quarter: number): number {
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;

    const quarterMonths = this.monthlyData.filter(item => {
      const monthNum = parseInt(item.month.replace('月', ''));
      return monthNum >= startMonth && monthNum <= endMonth;
    });

    return quarterMonths.reduce((sum, item) => sum + item.revenue, 0);
  }
}
