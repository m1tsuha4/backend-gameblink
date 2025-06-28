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

        const available = 35;

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
}
