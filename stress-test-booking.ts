import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { BookingService } from './src/booking/booking.service';
import { PrismaService } from './src/prisma/prisma.service';

async function bootstrap() {
  console.log('Bootstrapping app context for STRESS TEST...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const bookingService = app.get(BookingService);
  const prismaService = app.get(PrismaService);

  let dummyCabangId: string | null = null;
  let dummyUnitId: string | null = null;

  try {
    // 1. Setup Dummy Data
    const cabang = await prismaService.cabang.create({
      data: {
        nama_cabang: 'Stress Test Cabang',
        alamat_cabang: '123 Stress St',
        status: 'Aktif'
      }
    });
    dummyCabangId = cabang.id;

    const unit = await prismaService.unit.create({
      data: {
        cabang_id: cabang.id,
        nama_unit: 'PS5 Stress Test',
        jenis_konsol: 'PS5',
        harga: 50000
      }
    });
    dummyUnitId = unit.id;

    console.log(`\n✅ Setup complete. Testing Unit: ${unit.id}`);

    // 2. Prepare mock DTO
    const exactTime = new Date().toISOString(); 
    const bookingDto: any = {
      nama: 'Stress Tester',
      nomor_hp: '08123456789',
      email: 'test@example.com',
      cabang_id: unit.cabang_id,
      tanggal_main: exactTime,
      metode_pembayaran: 'CASH',
      total_harga: 50000,
      booking_details: [
        {
          unit_id: unit.id,
          jam_main: '14:00',
          harga: 50000,
        }
      ]
    };

    // 3. Fire Concurrent Requests!
    console.log(`\n🚀 Firing 5 concurrent booking requests at the EXACT SAME MILLISECOND...`);
    
    // We create an array of 5 identical promises that run simultaneously
    const promises = Array.from({ length: 5 }).map((_, index) => {
      return bookingService.createWalkinBooking(bookingDto)
        .then(res => {
          console.log(`Request ${index + 1}: ✅ SUCCEEDED! Booking Code: ${res.booking_code}`);
          return { success: true, id: res.id };
        })
        .catch(err => {
          console.log(`Request ${index + 1}: ❌ FAILED! Reason: ${err.message}`);
          return { success: false };
        });
    });

    // Wait for all 5 to finish
    const results = await Promise.all(promises);

    // 4. Analyze Results
    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);

    console.log('\n--- TEST RESULTS ---');
    console.log(`Total Successes: ${successes.length}`);
    console.log(`Total Failures: ${failures.length}`);

    if (successes.length === 1 && failures.length === 4) {
      console.log('🎉 RACE CONDITION PASSED! The system successfully prevented concurrent bookings!');
    } else {
      console.log('⚠️ TEST FAILED! Expected exactly 1 success and 4 failures.');
    }

    // 5. Cleanup
    console.log('\nCleaning up test data...');
    for (const res of successes) {
      if ('id' in res && res.id) await prismaService.booking.delete({ where: { id: res.id as string } });
    }
    await prismaService.unit.delete({ where: { id: unit.id } });
    await prismaService.cabang.delete({ where: { id: cabang.id } });
    console.log('Cleanup done.');

  } catch (error: any) {
    console.error('Test script encountered an error:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
