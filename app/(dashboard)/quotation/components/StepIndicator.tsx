import { CheckCircle, ClipboardList, Package, Upload } from 'lucide-react'
import React from 'react'
const STEPS = [
    { id: 1, label: 'Upload Quotation', icon: Upload },
    { id: 2, label: 'Review Items', icon: Package },
    { id: 3, label: 'Summary', icon: ClipboardList },
]

const StepIndicator = ({currentStep}:any) => (
    <div className="flex items-center gap-0 mb-6">
        {STEPS.map((step, idx) => {
            const isCompleted = currentStep > step.id
            const isActive = currentStep === step.id

            return (
                <div key={step.id} className="flex items-center">
                    <div className="flex items-center gap-2">
                        <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all
                            ${isCompleted ? 'bg-primary text-primary-foreground' : ''}
                            ${isActive ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2' : ''}
                            ${!isCompleted && !isActive ? 'bg-muted text-muted-foreground' : ''}
                        `}>
                            {isCompleted ? <CheckCircle className="w-4 h-4" /> : <span>{step.id}</span>}
                        </div>
                        <span className={`text-sm font-medium hidden sm:block ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {step.label}
                        </span>
                    </div>
                    {idx < STEPS.length - 1 && (
                        <div className={`h-px w-8 sm:w-16 mx-2 transition-all ${isCompleted ? 'bg-primary' : 'bg-border'}`} />
                    )}
                </div>
            )
        })}
    </div>
)

export default StepIndicator
