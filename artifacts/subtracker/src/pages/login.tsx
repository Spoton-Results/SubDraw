import * as React from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HardHat } from "lucide-react";
import toast from "react-hot-toast";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  usePageTitle("Sign In");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useGetMe({ query: { retry: false, staleTime: 30_000 } });
  const login = useLogin();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  React.useEffect(() => {
    if (user && !isLoading) setLocation("/");
  }, [user, isLoading, setLocation]);

  const onSubmit = async (data: LoginForm) => {
    try {
      await login.mutateAsync({ data });
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast.success("Welcome back!");
      setLocation("/");
    } catch (e: any) {
      toast.error(e?.data?.error || e?.message || "Login failed");
    }
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:block relative">
        <img 
          src={`${import.meta.env.BASE_URL}images/login-bg.png`}
          alt="Abstract construction site"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-12 text-white">
          <h2 className="text-4xl font-bold font-display mb-4">Build Better, Together.</h2>
          <p className="text-lg text-white/80 max-w-md">The modern subcontract management platform for GCs and Subcontractors.</p>
        </div>
      </div>
      
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8 text-primary">
            <div className="bg-primary text-white p-3 rounded-2xl shadow-lg shadow-primary/30">
              <HardHat className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold font-display text-foreground">SubTracker</h1>
          </div>

          <h2 className="text-2xl font-bold mb-2">Welcome back</h2>
          <p className="text-muted-foreground mb-8">Enter your credentials to access your account</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs text-primary font-semibold hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button 
              type="submit" 
              className="w-full mt-2" 
              isLoading={login.isPending}
            >
              Sign In
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/register" className="text-primary font-semibold hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
