import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboard() {
    return await this.dashboardService.getDashboard();
  }

  @Get('stats-booking')
 
  async statsBooking(
    @Query('cabang_id') cabang_id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return await this.dashboardService.statsBooking(cabang_id, startDate, endDate);
  }
}
