import { Category } from "@shopeer/domain";
import type { CategoryRepository } from "./ports.js";

export class CategoryUseCase {
    public constructor(
        private readonly categoryRepository: CategoryRepository,
    ) {}

    public async save(category: Category): Promise<Category> {
        return await this.categoryRepository.save(category);
    }

    public async fetchCategoryById(
        categoryId: string,
    ): Promise<Category | null> {
        return await this.categoryRepository.fetchCategoryById(categoryId);
    }

    public async fetchAllCategories(): Promise<Category[]> {
        return await this.categoryRepository.fetchAllCategories();
    }
}
