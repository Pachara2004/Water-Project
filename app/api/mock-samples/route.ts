import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { evaluateSample } from '@/lib/standards';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const locations = await prisma.location.findMany();
    if (locations.length === 0) {
      return NextResponse.json({ error: 'No locations found. Please create locations first.' }, { status: 400 });
    }

    const newSamples = [];
    const now = new Date();

    // Generate 50 mock samples
    for (let i = 0; i < 50; i++) {
      const loc = locations[Math.floor(Math.random() * locations.length)];
      
      // Randomize past 30 days
      const daysAgo = Math.floor(Math.random() * 30);
      const collectedAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      // Randomize time of day
      collectedAt.setHours(Math.floor(Math.random() * 24));
      
      // Randomize values around normal ranges with some spikes
      const isSpike = Math.random() > 0.8;
      const phosphateVal = isSpike ? (Math.random() * 1.5 + 0.5) : (Math.random() * 0.05); // mg/L
      const ammoniaVal = isSpike ? (Math.random() * 2.0 + 0.5) : (Math.random() * 0.1); // mg/L

      const evaluation = evaluateSample(phosphateVal, ammoniaVal);
      
      newSamples.push({
        locationId: loc.id,
        collectedBy: userId,
        phosphateVal,
        ammoniaVal,
        status: evaluation.overallStatus,
        collectedAt,
      });
    }

    const created = await prisma.sample.createMany({
      data: newSamples,
    });

    return NextResponse.json({ success: true, count: created.count });
  } catch (error) {
    console.error('Mock data generation error:', error);
    return NextResponse.json({ error: 'Failed to generate mock data' }, { status: 500 });
  }
}
