import * as React from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister, useGetMe } from "@workspace/api-client-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HardHat } from "lucide-react";
import toast from "react-hot-toast";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  companyName: z.string().min(1, "Company name is required"),
  role: z.enum(["GC", "SUB"]),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  usePageTitle("Create Account");
  const [, setLocation] = useLocation();
  const { data: user, isLoading } = useGetMe({ query: { retry: false } });
  const registerMutation = useRegister();

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "SUB"
    }
  });

  React.useEffect(() => {
    if (user && !isLoading && !(user as any).isDemo) setLocation("/dashboard");
  }, [user, isLoading, setLocation]);

  const onSubmit = async (data: RegisterForm) => {
    try {
      await registerMutation.mutateAsync({ data });
      toast.success("Account created successfully!");
      setLocation("/dashboard");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Registration failed");
    }
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8 text-primary">
            <div className="bg-primary text-white p-3 rounded-2xl shadow-lg shadow-primary/30">
              <HardHat className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold font-display text-foreground">SubDraw</h1>
          </div>

          <h2 className="text-2xl font-bold mb-2">Create an account</h2>
          <p className="text-muted-foreground mb-8">Join the network to manage construction projects</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Input
                placeholder="Company Name"
                {...register("companyName")}
              />
              {errors.companyName && <p className="text-sm text-destructive mt-1">{errors.companyName.message}</p>}
            </div>
            <div>
              <Input
                placeholder="Email address"
                {...register("email")}
              />
              {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <Input
                type="password"
                placeholder="Password"
                {...register("password")}
              />
              {errors.password && <p className="text-sm text-destructive mt-1">{errors.password.message}</p>}
            </div>
            
            <div className="pt-2">
              <label className="text-sm font-semibold mb-2 block">I am a:</label>
              <div className="grid grid-cols-2 gap-4">
                <label className="cursor-pointer">
                  <input type="radio" value="SUB" {...register("role")} className="peer sr-only" />
                  <div className="rounded-xl border-2 border-border p-4 text-center hover:bg-accent peer-checked:border-primary peer-checked:bg-primary/5 peer-checked:text-primary transition-all">
                    <span className="font-bold">Subcontractor</span>
                  </div>
                </label>
                <label className="cursor-pointer">
                  <input type="radio" value="GC" {...register("role")} className="peer sr-only" />
                  <div className="rounded-xl border-2 border-border p-4 text-center hover:bg-accent peer-checked:border-primary peer-checked:bg-primary/5 peer-checked:text-primary transition-all">
                    <span className="font-bold">General Contractor</span>
                  </div>
                </label>
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full mt-4" 
              isLoading={registerMutation.isPending}
            >
              Create Account
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
      
      <div className="hidden md:block relative">
        <img 
          src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
          alt="Abstract architecture"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/40 to-transparent flex flex-col justify-end p-12 text-white">
          <h2 className="text-4xl font-bold font-display mb-4">Streamline Your Contracts</h2>
          <p className="text-lg text-white/90 max-w-md">Say goodbye to messy spreadsheets. Track subcontracts, change orders, and invoices in one place.</p>
        </div>
      </div>
    </div>
  );
}
