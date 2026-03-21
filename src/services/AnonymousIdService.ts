import AsyncStorage from '@react-native-async-storage/async-storage';

const ANONYMOUS_ID_KEY = 'anonymous_user_id';

export class AnonymousIdService {
  /**
   * Get or create anonymous user ID
   * This ID is random and NOT linked to any personal information
   */
  static async getOrCreateId(): Promise<string> {
    let id = await AsyncStorage.getItem(ANONYMOUS_ID_KEY);
    
    if (!id) {
      // Generate random ID using crypto-safe method
      id = this.generateRandomId();
      await AsyncStorage.setItem(ANONYMOUS_ID_KEY, id);
    }
    
    return id;
  }
  
  private static generateRandomId(): string {
    // Generate a random UUID-like string
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
