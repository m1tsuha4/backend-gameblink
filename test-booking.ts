import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { BookingService } from './src/booking/booking.service';
import { PrismaService } from './src/prisma/prisma.service';

async function bootstrap() {
  console.log('Bootstrapping app context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const bookingService = app.get(BookingService);
  const prismaService = app.get(PrismaService);

  let dummyCabangId: string | null = null;
  let dummyUnitId: string | null = null;

  try {
    // 1. Ensure we have a valid unit
    let unit = await prismaService.unit.findFirst({
        where: {
            cabang_id: { not: null }
        }
    });

    if (!unit) {
      console.log('No unit found. Creating a dummy Cabang and Unit...');
      const cabang = await prismaService.cabang.create({
        data: {
          nama_cabang: 'Dummy Cabang Test',
          alamat_cabang: '123 Test St',
          status: 'Aktif'
        }
      });
      dummyCabangId = cabang.id;

      unit = await prismaService.unit.create({
        data: {
          cabang_id: cabang.id,
          nama_unit: 'PS5 Test',
          jenis_konsol: 'PS5',
          harga: 50000
        }
      });
      dummyUnitId = unit.id;
    }
    
    console.log(`Testing with Unit ID: ${unit.id}`);

    // 2. Prepare mock DTO
    const exactTime = new Date().toISOString(); // e.g. "2026-04-30T06:45:00.000Z"
    console.log(`Using exact time: ${exactTime}`);

    const bookingDto: any = {
      nama: 'Test User',
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

    // 3. Create Walkin Booking
    console.log('\n[1] Creating Walkin Booking...');
    const booking1 = await bookingService.createWalkinBooking(bookingDto);
    console.log('Successfully created booking 1:', booking1.booking_code);

    // 4. Verify exact time in DB
    const bookingInDb = await prismaService.booking.findUnique({
      where: { id: booking1.id },
      include: { booking_details: true }
    });

    console.log('\n--- DATABASE VERIFICATION ---');
    console.log('Booking tanggal_main in DB:', bookingInDb?.tanggal_main);
    console.log('BookingDetail tanggal in DB:', bookingInDb?.booking_details[0].tanggal);
    console.log('Exact Time Expected:', new Date(exactTime));

    if (bookingInDb?.tanggal_main.getTime() === new Date(exactTime).getTime()) {
      console.log('✅ Exact time successfully stored!');
    } else {
      console.log('❌ Exact time mismatch!');
    }

    // 5. Test Collision Prevention
    console.log('\n--- COLLISION TEST ---');
    console.log('Attempting to create another booking on the same day for the same unit & time...');
    
    // Use a slightly different time on the same day to simulate another user booking later
    const slightlyDifferentTime = new Date(exactTime);
    slightlyDifferentTime.setMinutes(slightlyDifferentTime.getMinutes() + 1); // Fixed to not cross days!
    console.log(`Slightly different time (same day): ${slightlyDifferentTime.toISOString()}`);

    const duplicateBookingDto = { ...bookingDto, tanggal_main: slightlyDifferentTime.toISOString() };
    
    try {
      await bookingService.createWalkinBooking(duplicateBookingDto);
      console.log('❌ FAIL: Duplicate booking was created!');
    } catch (error: any) {
      console.log('✅ PASS: Duplicate booking blocked correctly!');
      console.log('Error message:', error.message);
    }

    // Cleanup
    console.log('\nCleaning up test data...');
    await prismaService.booking.delete({ where: { id: booking1.id } });
    
    if (dummyUnitId) await prismaService.unit.delete({ where: { id: dummyUnitId } });
    if (dummyCabangId) await prismaService.cabang.delete({ where: { id: dummyCabangId } });
    console.log('Cleanup done.');

  } catch (error: any) {
    console.error('Test script encountered an error:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
