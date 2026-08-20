import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(v: number, symbol = 'R$'): string {
  return `${symbol} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function maskCnpj(v: string): string {
  return v
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function maskCpf(v: string): string {
  return v
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1-$2');
}

export function maskPhone(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
}

export function maskCep(v: string): string {
  return v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
}
