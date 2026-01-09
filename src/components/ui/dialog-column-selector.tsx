/**
 * @fileoverview A reusable dialog component for selecting visible columns in a table.
 */
'use client';

import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface ColumnConfig {
    id: string;
    label: string;
    defaultVisible?: boolean;
}

interface DialogColumnSelectorProps {
    allColumns: ColumnConfig[];
    visibleColumns: string[];
    onColumnChange: (columnId: string, checked: boolean) => void;
    onSave: () => void;
}

export function DialogColumnSelector({ allColumns, visibleColumns, onColumnChange, onSave }: DialogColumnSelectorProps) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Settings2 className="mr-2 h-4 w-4" />
                    Columnas
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Seleccionar Columnas Visibles</DialogTitle>
                    <DialogDescription>
                        Elige qué columnas deseas mostrar en la tabla de artículos.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                    {allColumns.map(column => (
                        <div key={column.id} className="flex items-center space-x-2">
                            <Checkbox
                                id={`col-${column.id}`}
                                checked={visibleColumns.includes(column.id)}
                                onCheckedChange={(checked) => onColumnChange(column.id, checked as boolean)}
                            />
                            <Label htmlFor={`col-${column.id}`} className="font-normal">
                                {column.label}
                            </Label>
                        </div>
                    ))}
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" onClick={onSave}>Guardar Preferencia</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
