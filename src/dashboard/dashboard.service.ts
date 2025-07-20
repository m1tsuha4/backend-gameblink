import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { addDays, format, isBefore } from 'date-fns';

@Injectable()
export class DashboardService {
    constructor (private readonly prisma: PrismaService) {}

    async getDashboard() {
        const currentDate = new Date();
        const todayStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        const todayEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1);

        // Count today's bookings
        const countBookingToday = await this.prisma.booking.count({
            where: {
            tanggal_transaksi: {
                gte: todayStart,
                lte: todayEnd,
            },
            },
        });

        // Sum total_harga for today
        const revenueResult = await this.prisma.booking.aggregate({
            _sum: {
            total_harga: true,
            },
            where: {
            tanggal_transaksi: {
                gte: todayStart,
                lte: todayEnd,
            },
            },
        });

        const revenueToday = revenueResult._sum.total_harga || 0;

        // Get best cabang by booking count
        const bestCabangGroup = await this.prisma.booking.groupBy({
            by: ['cabang_id'],
            _count: {
            cabang_id: true,
            },
            orderBy: {
            _count: {
                cabang_id: 'desc',
            },
            },
            take: 1,
        });

        let bestCabangName: string | null = null;

        if (bestCabangGroup.length > 0 && bestCabangGroup[0].cabang_id) {
            const cabang = await this.prisma.cabang.findUnique({
                where: {
                id: bestCabangGroup[0].cabang_id, // safe: now always a string
                },
                select: {
                nama_cabang: true,
                },
            });

            bestCabangName = cabang?.nama_cabang ?? null;
        }

        const available = await this.prisma.unit.count({});

        return {
            countBookingToday,
            available,
            revenueToday,
            bestCabang: bestCabangName,
        };
    }


    async statsBooking(cabang_id: string, startDate: string, endDate: string) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const results: { date: string; countBooking: number }[] = [];

        for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
            const dayStart = new Date(d);
            const dayEnd = new Date(d);
            dayEnd.setHours(23, 59, 59, 999);

            const count = await this.prisma.booking.count({
            where: {
                cabang_id, // optional filter by cabang
                tanggal_transaksi: {
                gte: dayStart,
                lte: dayEnd,
                },
            },
            });

            results.push({
                date: format(d, 'yyyy-MM-dd'),
                countBooking: count,
            });
        }

        return results;
    }

    async bookingSummaryByCabangAndKonsol(
        type?: string,
        metode_pembayaran?: string,
        startDate?: string,
        endDate?: string
      ) {
        // Build filter for bookings
        const where: any = {};
        if (startDate && endDate) {
          where.tanggal_main = {
            gte: new Date(startDate),
            lte: new Date(endDate),
          };
        }
        if (type) where.booking_type = type;
        if (metode_pembayaran) where.metode_pembayaran = metode_pembayaran;
  
        // Get all cabang and all jenis_konsol
        const cabangs = await this.prisma.cabang.findMany({
          select: { id: true, nama_cabang: true }
        });
        const units = await this.prisma.unit.findMany({
          select: { jenis_konsol: true },
          distinct: ['jenis_konsol']
        });
        const konsolTypes = units.map(u => u.jenis_konsol);
  
        // Query all bookings with details and units
        const bookings = await this.prisma.booking.findMany({
          where,
          include: {
            cabang: true,
            booking_details: {
              include: { unit: true }
            }
          }
        });
  
        // Prepare summary
        const summary = cabangs.map(cabang => {
          const cabangBookings = bookings.filter(b => b.cabang_id === cabang.id);
          const konsolSummary = konsolTypes.map(jenis_konsol => {
            // Filter booking_details for this konsol
            const details = cabangBookings.flatMap(b =>
              b.booking_details.filter(d => d.unit?.jenis_konsol === jenis_konsol)
            );
            const totalRevenue = details.reduce((sum, d) => sum + (d.harga || 0), 0);
            return {
              jenis_konsol,
              totalRevenue
            };
          });
          const totalRevenue = konsolSummary.reduce((sum, k) => sum + k.totalRevenue, 0);
          return {
            cabang: cabang.nama_cabang,
            konsolSummary,
            totalRevenue
          };
        });
  
        return summary;
      }
}
