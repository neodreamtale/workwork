import { NextRequest, NextResponse } from 'next/server';
import { Blueprint } from '../../../../steps/src/workflow/Blueprint';
import { toFlattenDTO } from '../../../../steps/src/ui/utils';

// v1.0.1 - Force recompile
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;
        if (!id) {
            return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        }

        const chain = await Blueprint.loadDeep(id);
        const dto = toFlattenDTO(chain);

        return NextResponse.json(dto);
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
