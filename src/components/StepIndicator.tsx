interface StepIndicatorProps {
  step: number;
  total: number;
}

export default function StepIndicator({ step, total }: StepIndicatorProps) {
  return (
    <div className="mb-6 flex flex-col items-center gap-2">
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`h-1.5 w-8 rounded-full ${index < step ? 'bg-primary' : 'bg-border'}`}
          />
        ))}
      </div>
      <p className="text-xs font-medium text-text-caption">
        Paso {step} de {total}
      </p>
    </div>
  );
}
