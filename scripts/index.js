//@ts-check
import { world, system, BlockPermutation, ItemStack } from '@minecraft/server';
import { MinecraftBlockTypes, MinecraftEnchantmentTypes, MinecraftItemTypes } from './lib/index.js';

/**
 * 二項分布に基づいてドロップ数を計算する関数
 * @param {number} n 試行回数
 * @param {number} p 成功確率 (0 <= p <= 1)
 * @returns {number} 成功回数 (ドロップ数)
 */
const getBinomialDrop = function(n, p) {
    let drops = 0;
    for (let i = 0; i < n; i++) {
        if (Math.random() < p) {
            drops++;
        }
    }

    return drops;
};

/**
 * 二項分布は試行回数n=3でドロップ確率p=約0.57（4/7≒57%）のものである
 * https://minecraft.fandom.com/ja/wiki/%E5%B9%B8%E9%81%8B_(%E3%82%A8%E3%83%B3%E3%83%81%E3%83%A3%E3%83%B3%E3%83%88)#cite_ref-Four_1-0
 * @param {String} itemId 
 * @param {Number} level 
 * @returns {Number}
 */
const getDropAmount = function(itemId, level){
    let dropAmount;

    if(itemId === MinecraftItemTypes.NetherWart){
        dropAmount = Math.floor(Math.random() * (3 + level)) + 1;
    }
    
    else{
        dropAmount = getBinomialDrop(3 + level, 0.57);

        if(itemId === MinecraftItemTypes.Carrot || itemId === MinecraftItemTypes.Potato) dropAmount++;
    }

    return dropAmount;
};

const coordMap = new Map();

system.runInterval(()=>{
    for(const map of coordMap){
        system.runTimeout(()=>{
            coordMap.delete(map[0]);
        }, 1);
    }
});

world.beforeEvents.playerInteractWithBlock.subscribe((ev)=>{
    const { block, player, itemStack } = ev;
    
    const beforeCoordinate = coordMap.get(player);
    if(beforeCoordinate && (block.location.x === beforeCoordinate.x && block.location.y === beforeCoordinate.y && block.location.z === beforeCoordinate.z)) return;

    coordMap.set(player, block.location);
    const growth = block.permutation.getState("growth");
    const age = block.permutation.getState("age");
    const enchantable = itemStack?.getComponent("enchantable");

    let level;

    if(enchantable?.hasEnchantment(MinecraftEnchantmentTypes.Fortune)){
        level = enchantable.getEnchantment(MinecraftEnchantmentTypes.Fortune)?.level;
    }

    //幸運のエンチャントが付いていない場合0を代入
    if(!level) level = 0;
    
    //作物
    if(growth === 7){
        let seed;
        let harvest;

        switch(block.typeId){
            case MinecraftBlockTypes.Wheat : {
                const amount = getDropAmount(MinecraftItemTypes.WheatSeeds, level);
                if(amount != 0) seed = new ItemStack(MinecraftItemTypes.WheatSeeds, amount);
                harvest = new ItemStack(MinecraftItemTypes.Wheat);
                break;
            }
                
            case MinecraftBlockTypes.Carrots : {
                //amountは1以上
                const amount = getDropAmount(MinecraftItemTypes.Carrot, level);
                harvest = new ItemStack(MinecraftItemTypes.Carrot, amount);
                break;
            }
            
            case MinecraftBlockTypes.Potatoes : {
                //amountは1以上
                const amount = getDropAmount(MinecraftItemTypes.Potato, level);
                harvest = new ItemStack(MinecraftItemTypes.Potato, amount);
                break;
            }

            case MinecraftBlockTypes.Beetroot : {
                const amount = getDropAmount(MinecraftItemTypes.BeetrootSeeds, level);
                if(amount != 0) seed = new ItemStack(MinecraftItemTypes.BeetrootSeeds, amount);
                harvest = new ItemStack(MinecraftItemTypes.Beetroot);
                break;
            }
        }

        system.run(()=>{
            if(seed) player.dimension.spawnItem(seed, block.location);
            if(harvest) player.dimension.spawnItem(harvest, block.location);
            block.setPermutation(BlockPermutation.resolve(block.typeId, { growth: 0 }));
        });
    }

    //ネザーウォート
    if(block.typeId === MinecraftBlockTypes.NetherWart && age === 3){
        const amount = getDropAmount(MinecraftItemTypes.NetherWart, level);
        let harvest = new ItemStack(MinecraftItemTypes.NetherWart, amount);

        system.run(()=>{
            if(harvest) player.dimension.spawnItem(harvest, block.location);
            block.setPermutation(BlockPermutation.resolve(block.typeId, { age: 0 }));
        });
    }

    //ココア
    if(block.typeId === MinecraftBlockTypes.Cocoa && age === 2){
        let harvest = new ItemStack(MinecraftItemTypes.CocoaBeans, 2);

        system.run(()=>{
            const direction = block.permutation.getState("direction");
            if(harvest) player.dimension.spawnItem(harvest, block.location);
            block.setPermutation(BlockPermutation.resolve(block.typeId, { age: 0, direction: direction }));
        });
    }
});