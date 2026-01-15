import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as midtransClient from 'midtrans-client';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class MidtransService {
  private snap;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    this.snap = new midtransClient.Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: process.env.MIDTRANS_SERVER_KEY,
      clientKey: process.env.MIDTRANS_CLIENT_KEY,
    });
  }

async createTransaction(booking: any, paymentType?: string) { // Jadikan paymentType opsional dengan '?'
    const baseAmount = booking.total_harga;
    let fee = 0;
    
    // Salin item details asli agar tidak termutasi
    const bookingTanggal = booking.tanggal_main
      ? new Date(booking.tanggal_main).toLocaleDateString('id-ID', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '';

    const cabangNama = booking.cabang?.nama_cabang || '';

    const itemDetails = booking.booking_details.map((detail, index) => {
      let itemName = `Sewa ${detail.unit?.nama_unit || detail.unit_id} ${cabangNama ? `- ${cabangNama}` : ''} @ ${bookingTanggal || ''} ${detail.jam_main}`.trim();
      
      if (itemName.length > 50) {
        itemName = itemName.substring(0, 47) + '...';
      }

      return {
        id: `unit-${index + 1}`,
        name: itemName,
        quantity: 1,
        price: detail.harga,
      };
    });

    // Siapkan payload dasar
    const payload: any = { // Gunakan 'any' untuk fleksibilitas properti
      transaction_details: {
        order_id: booking.id, // ID UUID yang aman URL dan sesuai format (tanpa spasi/kurung)
      },
      custom_field1: booking.booking_code, // Simpan booking code di sini
      customer_details: {
        first_name: booking.nama,
        email: booking.email,
        phone: booking.nomor_hp,
      },
      item_details: itemDetails,
    };
    
    // Cek jika paymentType diberikan (pengguna memilih di awal)
    if (paymentType) {
      // Hitung fee berdasarkan metode yang dipilih
      switch (paymentType) {
        case 'bank_transfer':
          fee = 4000;
          break;
        case 'gopay':
        case 'shopeepay':
          fee = Math.round(baseAmount * 0.02); // 2%
          break;
        case 'other_qris':
          fee = Math.round(baseAmount * 0.007); // 0.7%
          break;
        case 'dana':
          fee = Math.round(baseAmount * 0.015); // 1.5%
          break;
        default:
          fee = 0;
      }

      // Tambahkan fee ke item_details jika ada
      if (fee > 0) {
        payload.item_details.push({
          id: 'fee',
          name: 'Convenience Fee',
          quantity: 1,
          price: fee,
        });
      }
      
      // Atur total harga dan kunci metode pembayaran
      payload.transaction_details.gross_amount = baseAmount + fee;
      payload.enabled_payments = [paymentType];

    } else {
      payload.transaction_details.gross_amount = baseAmount; 
    }

    console.log('Sending Midtrans Payload:', JSON.stringify(payload, null, 2));

    try {
      return await this.snap.createTransaction(payload);
    } catch (error) {
      console.error('Midtrans Create Transaction Failed:', error?.response || error);
      throw error;
    }
  }


 async handleNotification(notification: any) {
    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const paymentType = notification.payment_type;

    const bookingId = orderId.split(' ')[0];

    let status_pembayaran: 'Berhasil' | 'Pending' | 'Gagal';
    let status_booking: 'Aktif' | 'Selesai' | 'Dibatalkan' | 'TidakAktif';

    if (['settlement', 'capture'].includes(transactionStatus)) {
      status_pembayaran = 'Berhasil';
      status_booking = 'Aktif';
    } else if (transactionStatus === 'pending') {
      status_pembayaran = 'Pending';
      status_booking = 'TidakAktif';
    } else {
      status_pembayaran = 'Gagal';
      status_booking = 'Dibatalkan';
    }

    await this.prisma.booking.updateMany({
      where: { id: bookingId },
      data: {
        status_booking,
        status_pembayaran,
        metode_pembayaran: paymentType,
      },
    });

    if (status_pembayaran !== 'Pending') {
      await this.redis.releaseSlotLocksForBooking(bookingId);
    }

    return { success: true };
  }
}
