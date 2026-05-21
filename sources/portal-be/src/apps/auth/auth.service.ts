import { Injectable } from '@nestjs/common';
import { supabase } from '../../libs/database/supabase';

@Injectable()
export class AuthService {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data;
  }

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    return { success: true };
  }
}
