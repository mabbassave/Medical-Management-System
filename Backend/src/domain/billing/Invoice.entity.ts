import { randomUUID } from 'crypto';

export interface InvoiceItem {
  description: string;
  amount: number;
}

export interface InvoiceProps {
  invoiceId: string;
  patientId: string;
  appointmentId: string;
  items: InvoiceItem[];
  totalAmount: number;
  status: 'pending' | 'paid';
  createdAt: Date;
}

export class Invoice {
  private _invoiceId: string;
  private _patientId: string;
  private _appointmentId: string;
  private _items: InvoiceItem[];
  private _totalAmount: number;
  private _status: 'pending' | 'paid';
  private _createdAt: Date;

  constructor(props: InvoiceProps) {
    this._invoiceId = props.invoiceId;
    this._patientId = props.patientId;
    this._appointmentId = props.appointmentId;
    this._items = props.items;
    this._totalAmount = props.totalAmount;
    this._status = props.status;
    this._createdAt = props.createdAt;
  }

  public static create(dto: { patientId: string; appointmentId: string; items: InvoiceItem[] }): Invoice {
    const total = dto.items.reduce((sum, i) => sum + i.amount, 0);
    return new Invoice({
      invoiceId: '', // will be set by service/repository
      patientId: dto.patientId,
      appointmentId: dto.appointmentId,
      items: dto.items,
      totalAmount: total,
      status: 'pending',
      createdAt: new Date(),
    });
  }

  // Getters
  public get invoiceId(): string { return this._invoiceId; }
  public get patientId(): string { return this._patientId; }
  public get appointmentId(): string { return this._appointmentId; }
  public get items(): InvoiceItem[] { return this._items; }
  public get totalAmount(): number { return this._totalAmount; }
  public get status(): 'pending' | 'paid' { return this._status; }
  public get createdAt(): Date { return this._createdAt; }

  // Mutators used by repository/service
  public set invoiceId(id: string) { this._invoiceId = id; }

  public markAsPaid(): void {
    this._status = 'paid';
  }

  public toJSON() {
    return {
      invoiceId: this._invoiceId,
      patientId: this._patientId,
      appointmentId: this._appointmentId,
      items: this._items,
      totalAmount: this._totalAmount,
      status: this._status,
      createdAt: this._createdAt,
    };
  }
}
